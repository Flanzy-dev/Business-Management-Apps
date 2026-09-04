// The HTTP+SSE server that lets every device on a shop's network see the
// same data — extracted from electron/main.ts so it can run two ways:
// embedded in the Electron main process (the shop-PC LAN server, port 5174)
// or standalone under plain Node (a Ubuntu box acting as the always-on
// host — see server/index.ts). Same routes, same behavior, either way; a
// protocol change here can't drift between the two deployments.
//
// Auth is optional and off by default: pass `token` to require every
// /api/* call to carry it (the Electron LAN server leaves it unset, so
// today's shop-PC setups keep working exactly as before). See
// src/lib/sync/client.ts for how the renderer sends it.
import * as fs from 'fs'
import * as http from 'http'
import * as path from 'path'
import { createHash, timingSafeEqual } from 'crypto'
import { isOpRow, type SyncDatabase, type OpRow } from './db'

export interface SyncServerOptions {
  db: SyncDatabase
  /** Built app (`vite build`'s dist/) to serve to any device that just opens
   *  this server's URL in a browser — omit to run API-only. */
  distDir?: string
  /**
   * Shared shop password. When set, every /api/* request must carry it via
   * the `x-shop-token` header or (for the SSE route, which can't set
   * headers) a `?token=` query param.
   *
   * Accepts a getter as well as a plain string: the embedded Electron
   * server (see electron/main.ts) is constructed once at app.whenReady(),
   * long before Settings > Security's "Require token on LAN" switch could
   * be flipped, so a plain string captured at construction time could never
   * reflect a later change without an app restart. A getter is re-read on
   * every single request instead.
   */
  token?: string | (() => string | undefined)
  /** Read out of settings-store for the /api/info handshake, so a device
   *  can confirm it reached the shop it meant to before adopting this
   *  server's data — see src/pages/Settings.tsx's "Test connection".
   *  Returns null when the shop has no name set; how that absence is shown
   *  is the client's call. See server/shopName.ts for the implementation
   *  both deployments pass in. */
  getShopName?: () => string | null
  /**
   * When set, /api/ops POST rejects any op whose `entity` isn't in this
   * list — e.g. an op claiming `entity: 'sync-host'`, which would otherwise
   * sit in the oplog forever (nothing on the server's own write path stops
   * it; it's only ever contained downstream by each client's SYNC_UNITS
   * filter). Deliberately an injected list, not an import of the app's own
   * registry: this file has no other reason to know what a "customer-store"
   * is, and that ignorance is what lets it run standalone or embedded with
   * zero drift between the two. Omit to accept any entity, e.g. for a
   * deployment that hasn't wired this up yet.
   */
  allowedEntities?: readonly string[]
  /**
   * When set, /api/snapshot only sends keys this predicate accepts.
   * key_value_store itself has no way to distinguish shop data from a
   * device's own bookkeeping (device-id, sync-host, …) — see
   * src/lib/sync/engine.ts's joinCold(), which already filters on the
   * client side and doesn't strictly need this — but a server-side filter
   * means a client bug can't leak another device's identity even
   * temporarily. Omit to send the whole snapshot unfiltered, e.g. for a
   * deployment that hasn't wired this up yet.
   */
  isSyncableKey?: (key: string) => boolean
}

/**
 * DNS-rebinding guard: a shop LAN has no fixed hostname for this server (any
 * device reaches it by whatever IP it's on — 192.168.x.x, 10.x.x.x, or
 * localhost/127.0.0.1 from the shop PC itself), so the Host header on a
 * legitimate request is always one of those literals, never a public DNS
 * name. Rebinding relies on an attacker's own hostname resolving to this
 * machine's IP *after* the browser already trusts it as same-origin — that
 * attack still sends the attacker's hostname as Host (the browser doesn't
 * rewrite it to the resolved IP), so rejecting any Host that isn't a
 * loopback/private-range literal closes it without needing to know this
 * machine's actual bound addresses.
 *
 * Reused below by resolveCorsOrigin to recognize a CALLER's origin as
 * "some other device on this LAN," not just this request's own Host — see
 * that function's comment for why the two are different questions.
 */
const ALLOWED_HOST_PATTERN =
  /^(localhost|127(?:\.\d{1,3}){3}|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})(?::\d+)?$/i

function isAllowedHost(req: http.IncomingMessage): boolean {
  const host = req.headers.host
  return typeof host === 'string' && ALLOWED_HOST_PATTERN.test(host)
}

/**
 * The CORS header to answer this request with, or null to send none at all.
 *
 * This USED to only echo an Origin whose host matched THIS request's own
 * Host header — i.e. "a page this same server itself served." That reads
 * plausible but is wrong for how this app is actually used: pairing two
 * devices is INHERENTLY a cross-origin call — a tablet that loaded its app
 * from device A's address (`http://192.168.1.5:5174`) has to reach device
 * B's address (`http://192.168.1.9:5174`) to test/follow it, and those two
 * origins never match by construction. The old check silently broke every
 * "Test connection" / follow-a-different-host flow — the CORS response
 * carried no Access-Control-Allow-Origin, so the browser refused to let the
 * fetch() read device B's response at all, surfacing as a plain failed/timed-
 * out test with no server-side error to see.
 *
 * The actual question isn't "does this match MY host" — it's "is this
 * caller ALSO something running this app," which is either (a) this app's
 * own Electron shell, whose file://-loaded renderer sends the literal
 * Origin value "null" for any cross-origin fetch, or (b) another device
 * reachable the same LAN-only way this one is — i.e. its Origin's own host
 * passes the exact same private-range/loopback pattern isAllowedHost checks
 * this request's Host against. An arbitrary public page (`https://evil.com`)
 * satisfies neither: browsers report a script's true origin honestly, so
 * that Origin header can't be spoofed to look like a LAN address.
 *
 * Trade-off accepted for the null-origin case: any other page with an
 * opaque origin (a sandboxed iframe without allow-same-origin, a data:
 * URL) also presents Origin: null, so this can't distinguish "this app's
 * own shell" from "some other null-origin page that happens to also be
 * loaded on a device that can reach this port." Combined with isAllowedHost
 * still gating the actual request's Host, and the optional shop-token gate,
 * this stays inside the app's stated LAN-only threat model rather than
 * opening it back up to the public internet the way the old wildcard did.
 */
function resolveCorsOrigin(req: http.IncomingMessage): string | null {
  const origin = req.headers.origin
  if (typeof origin !== 'string') return null
  if (origin === 'null') return origin
  try {
    return ALLOWED_HOST_PATTERN.test(new URL(origin).host) ? origin : null
  } catch {
    return null
  }
}

function corsHeaders(req: http.IncomingMessage): Record<string, string> {
  const origin = resolveCorsOrigin(req)
  return origin ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}
}

function isValidJson(text: string): boolean {
  try {
    JSON.parse(text)
    return true
  } catch {
    return false
  }
}

function sendJson(res: http.ServerResponse, status: number, data: unknown, cors: Record<string, string> = {}): void {
  const body = JSON.stringify(data)
  res.writeHead(status, {
    'Content-Type': 'application/json',
    ...cors,
  })
  res.end(body)
}

// Generous for a batch of ops (each op is one row's JSON), but small enough
// that one request can't exhaust the host process — this server has no
// other size guard, and the host is, in the Electron deployment, the same
// process the shop is actively using for everything else.
const MAX_REQUEST_BODY_BYTES = 2 * 1024 * 1024

class RequestTooLargeError extends Error {}

function readRequestBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let total = 0
    let settled = false
    req.on('data', (chunk: Buffer) => {
      if (settled) return
      total += chunk.length
      if (total > MAX_REQUEST_BODY_BYTES) {
        // Deliberately NOT req.destroy() here — that tears down the shared
        // HTTP/1.1 socket before the caller's catch block gets a chance to
        // write a 413 response, so the client sees a bare connection reset
        // instead of an actual answer. Just stop accumulating chunks and
        // reject; Node's own TCP flow control pushes back on the sender
        // without this process ever buffering the rest of an oversized body.
        settled = true
        reject(new RequestTooLargeError('request body too large'))
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (!settled) resolve(Buffer.concat(chunks).toString('utf8'))
    })
    req.on('error', (err) => {
      if (!settled) reject(err)
    })
  })
}

/**
 * Which ops in a POST /api/ops batch are rejected, and why — pure so it's
 * testable without going through HTTP at all (previously only reachable by
 * firing a real request at the server). Every op in a batch is checked before
 * ANY is inserted — a batch is one push from one device; accepting the first
 * N and rejecting the rest would leave that device unsure what actually
 * landed. See server/db.ts's isOpRow for the wire-shape check and
 * SyncServerOptions.allowedEntities for the optional entity check.
 */
export function validateOpBatch(
  parsed: unknown[],
  allowedEntitySet: Set<string> | null
): { index: number; reason: string }[] {
  const rejected: { index: number; reason: string }[] = []
  parsed.forEach((op: unknown, index: number) => {
    if (!isOpRow(op)) {
      rejected.push({ index, reason: 'malformed op' })
    } else if (allowedEntitySet && !allowedEntitySet.has(op.entity)) {
      rejected.push({ index, reason: `entity not allowed: ${op.entity}` })
    } else if (op.kind !== 'delete' && !isValidJson(op.payload)) {
      // A 'delete' op's payload is always '' (see types.ts) — never
      // JSON. Every other kind gets JSON.parse'd downstream by
      // applyOpsToBlob (merge.ts) and by materializeOps just below;
      // rejecting an unparsable payload here means that op is never
      // durably accepted at all, instead of landing in the oplog and
      // wedging every future /api/ops pull for every device that ever
      // fetches it — see src/lib/sync/quarantine.ts for the client-
      // side half of this same fix, for a payload that got in before
      // this check existed.
      rejected.push({ index, reason: 'payload is not valid JSON' })
    }
  })
  return rejected
}

const STATIC_MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

/**
 * Serves the built app's own files, so any device with no install to talk to
 * can load the app by pointing a browser straight at this server. Falls back
 * to index.html for any path that isn't a real file — the client-side router
 * (React Router) then takes over, same as any SPA host. Deliberately NOT
 * gated by `token` — there has to be some unauthenticated way to reach the
 * screen that asks for the password.
 */
function serveStaticFile(distDir: string, req: http.IncomingMessage, res: http.ServerResponse): void {
  const urlPath = decodeURIComponent((req.url as string).split('?')[0])
  const filePath = path.join(distDir, urlPath === '/' ? 'index.html' : urlPath)

  // Guard against a path that climbs out of distDir. A prefix check here
  // (`filePath.startsWith(distDir)`) used to be the guard, and it was wrong:
  // distDir carries no trailing separator, so a sibling directory whose name
  // merely starts with distDir's basename (e.g. distDir 'dist' + climb into
  // 'dist-server') passes a bare prefix check while landing entirely outside
  // distDir. path.relative is the actual boundary test — it only starts with
  // '..' when filePath is outside distDir, sibling-prefix or not.
  const rel = path.relative(distDir, filePath)
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    res.writeHead(403)
    res.end()
    return
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      fs.readFile(path.join(distDir, 'index.html'), (indexErr, indexData) => {
        if (indexErr) {
          res.writeHead(404)
          res.end('Not found — this server has no built app to serve.')
          return
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(indexData)
      })
      return
    }
    const ext = path.extname(filePath)
    res.writeHead(200, { 'Content-Type': STATIC_MIME_TYPES[ext] || 'application/octet-stream' })
    res.end(data)
  })
}

export interface SyncServer {
  server: http.Server
  /** Closes every open SSE connection and the server itself — call on shutdown. */
  close(): void
}

export function createSyncServer(options: SyncServerOptions): SyncServer {
  const { db, distDir, token, getShopName, allowedEntities, isSyncableKey } = options
  const allowedEntitySet = allowedEntities ? new Set(allowedEntities) : null
  let sseClients: http.ServerResponse[] = []

  function broadcastOpsAvailable(): void {
    for (const res of sseClients) {
      try {
        res.write('event: ops\ndata: {}\n\n')
      } catch {
        // Client disconnected between broadcasts; its own 'close' handler
        // will drop it from sseClients shortly.
      }
    }
  }

  /** SHA-256 both sides first: crypto.timingSafeEqual throws on a length
   *  mismatch rather than just returning false, and a wrong-length guess
   *  is exactly the case a timing-safe compare exists to not leak — hashing
   *  first makes both inputs a fixed 32 bytes before the constant-time
   *  comparison ever runs. */
  function safeEqual(a: string, b: string): boolean {
    return timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest())
  }

  /** True if this request is allowed through — checks the header for
   *  ordinary calls and the query param for SSE (EventSource can't set
   *  headers). Always true when no token is configured. Resolves a token
   *  getter fresh on every call, so a token that starts being required
   *  mid-run (see the `token` option's doc comment) takes effect
   *  immediately, not just for connections opened after a restart. */
  function isAuthorized(req: http.IncomingMessage, url: URL): boolean {
    const currentToken = typeof token === 'function' ? token() : token
    if (!currentToken) return true
    const header = req.headers['x-shop-token']
    if (typeof header === 'string' && safeEqual(header, currentToken)) return true
    const queryToken = url.searchParams.get('token')
    return queryToken !== null && safeEqual(queryToken, currentToken)
  }

  function handleInfo(cors: Record<string, string>, res: http.ServerResponse): void {
    sendJson(res, 200, { ok: true, shopName: getShopName?.() ?? null, seq: db.currentMaxSeq() }, cors)
  }

  function handleSnapshot(cors: Record<string, string>, res: http.ServerResponse): void {
    // Paired with `seq` so the caller (a device joining cold) knows exactly
    // which op it can start pulling *after* — see src/lib/sync/engine.ts.
    const full = db.snapshot()
    const data = isSyncableKey
      ? Object.fromEntries(Object.entries(full).filter(([key]) => isSyncableKey(key)))
      : full
    sendJson(res, 200, { data, seq: db.currentMaxSeq() }, cors)
  }

  function handleOpsGet(url: URL, cors: Record<string, string>, res: http.ServerResponse): void {
    const since = parseInt(url.searchParams.get('since') || '0', 10) || 0
    sendJson(res, 200, db.opsSince(since), cors)
  }

  async function handleOpsPost(req: http.IncomingMessage, res: http.ServerResponse, cors: Record<string, string>): Promise<void> {
    // Rejecting anything but application/json keeps this off the CORS
    // "simple request" list (text/plain, form-urlencoded, multipart are
    // simple; application/json is not) — a simple request skips the
    // preflight, so a cross-origin page could otherwise fire a real write
    // with zero opportunity for corsHeaders() above to ever be consulted.
    const contentType = req.headers['content-type']
    if (typeof contentType !== 'string' || !contentType.toLowerCase().startsWith('application/json')) {
      sendJson(res, 415, { error: 'expected application/json' }, cors)
      return
    }
    try {
      const body = await readRequestBody(req)
      const parsed = JSON.parse(body)
      if (!Array.isArray(parsed)) {
        sendJson(res, 400, { error: 'expected a JSON array of ops' }, cors)
        return
      }
      const rejected = validateOpBatch(parsed, allowedEntitySet)
      if (rejected.length > 0) {
        sendJson(res, 400, { error: 'rejected ops', rejected }, cors)
        return
      }
      const ops = parsed as OpRow[]
      const seqs = ops.map((op) => db.opsInsertOne(op))
      // Keep key_value_store a correct materialization of the oplog on
      // every deployment — see db.ts's materializeOps doc comment for why
      // this matters most for the standalone server, which has no
      // Electron IPC bridge writing key_value_store any other way.
      db.materializeOps(ops.map((op, i) => ({ ...op, seq: seqs[i] ?? db.currentMaxSeq() })))
      db.persist()
      broadcastOpsAvailable()
      sendJson(res, 200, { seqs }, cors)
    } catch (e) {
      if (e instanceof RequestTooLargeError) {
        sendJson(res, 413, { error: 'request body too large' }, cors)
      } else {
        sendJson(res, 400, { error: String(e) }, cors)
      }
    }
  }

  function handleEvents(req: http.IncomingMessage, res: http.ServerResponse, cors: Record<string, string>): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      ...cors,
    })
    res.write('\n')
    sseClients.push(res)
    req.on('close', () => {
      sseClients = sseClients.filter((client) => client !== res)
    })
  }

  const server = http.createServer(async (req, res) => {
    // Reject before anything else — including before the token check, which
    // a Host-spoofed request could otherwise still reach and brute-force.
    // See isAllowedHost's doc comment for what this specifically closes.
    if (!isAllowedHost(req)) {
      res.writeHead(400)
      res.end()
      return
    }

    const url = new URL(req.url ?? '/', `http://${req.headers.host}`)
    const cors = corsHeaders(req)

    // The browser's own preflight for any cross-origin call that isn't
    // CORS-"simple" — pushOps (src/lib/sync/client.ts) always sends
    // Content-Type: application/json, which never is, so every cross-origin
    // /api/ops POST (the normal case: pairing two devices means their
    // origins never match) sends one of these first. With no route for it
    // this used to fall through to the catch-all 404 with no CORS headers,
    // so the browser aborted before the real POST was ever sent — Test
    // Connection (a plain GET, no preflight needed) could succeed while
    // actual syncing silently never worked. Answered before the auth check:
    // a preflight carries no credentials worth checking, only the real
    // request that follows is authorized.
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        ...cors,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'content-type, x-shop-token',
        'Access-Control-Max-Age': '86400',
      })
      res.end()
      return
    }

    if (url.pathname.startsWith('/api/') && !isAuthorized(req, url)) {
      sendJson(res, 401, { error: 'unauthorized' }, cors)
      return
    }

    if (url.pathname === '/api/info' && req.method === 'GET') {
      handleInfo(cors, res)
      return
    }

    if (url.pathname === '/api/snapshot' && req.method === 'GET') {
      handleSnapshot(cors, res)
      return
    }

    if (url.pathname === '/api/ops' && req.method === 'GET') {
      handleOpsGet(url, cors, res)
      return
    }

    if (url.pathname === '/api/ops' && req.method === 'POST') {
      await handleOpsPost(req, res, cors)
      return
    }

    if (url.pathname === '/api/events' && req.method === 'GET') {
      handleEvents(req, res, cors)
      return
    }

    if (req.method === 'GET' && distDir) {
      serveStaticFile(distDir, req, res)
      return
    }

    res.writeHead(404)
    res.end()
  })

  return {
    server,
    close() {
      for (const client of sseClients) client.end()
      server.close()
    },
  }
}
