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
import { createHash, randomBytes, timingSafeEqual } from 'crypto'
import { isOpRow, type SyncDatabase, type OpRow } from './db'
import { verifyPasswordHash } from './passwordVerify'
import { createLoginRateLimiter } from './loginRateLimit'
import type { ShopAccount } from './shopAccounts'
import { adminUsernameMatches } from '../src/lib/auth/username'

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
  /**
   * The WORKER-tier counterpart to `token` above — a request presenting
   * EITHER this or `token` passes the general /api/* gate (isAuthorized),
   * since a worker-paired device still needs to read/write ordinary shop
   * data. The two are NOT interchangeable everywhere, though:
   * validateOpBatch's security-store check requires specifically `token`
   * (the admin one) — see that function's doc for why a worker credential
   * must not be able to rewrite the shop's admin account. See
   * src/store/securityStore.ts's workerLanToken doc for the full picture.
   */
  workerToken?: string | (() => string | undefined)
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
  /**
   * The shop's login accounts, for POST /api/login — see
   * server/shopAccounts.ts's readShopAccounts, which both deployments pass
   * in. A getter for the same reason `token` is one: accounts arrive by
   * normal security-store sync long after this server was constructed, so a
   * snapshot taken at startup would never see the shop's first account.
   *
   * Omit to disable /api/login entirely (it answers 404, as it did before
   * this route existed) — a deployment with no accounts wired up should not
   * appear to offer a login that can never succeed.
   */
  getAccounts?: () => ShopAccount[]
  /**
   * The LAN token to hand a caller that just authenticated, or null when the
   * shop has none — see server/shopAccounts.ts's readLanTokenForHandover for
   * why this is a *different* question from `token` above (that one is "what
   * must a request carry", this one is "what should a device leave here
   * holding"). Only ever consulted after a successful /api/login.
   */
  /** Now takes the role /api/login matched, so an admin login leaves a
   *  device holding the admin-tier token and a worker login leaves it
   *  holding the worker-tier one — see `workerToken` above for why the two
   *  must differ. */
  getLanToken?: (role: ShopAccount['role']) => string | null
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

/**
 * A structurally valid hash that no password can match, derived once per
 * process from random bytes. POST /api/login runs a real verification
 * against this when the username doesn't exist, so an unknown name costs the
 * same PBKDF2 wall time as a known one — without it, "fast 401" would mean
 * "no such user" and "slow 401" would mean "right user, wrong password",
 * handing an attacker the account name for free. Iteration count matches
 * src/lib/auth/password.ts's PBKDF2_ITERATIONS so the two paths cost alike.
 */
const DUMMY_HASH = `pbkdf2$sha256$210000$${randomBytes(16).toString('base64')}$${randomBytes(32).toString('base64')}`

// --- security core ---------------------------------------------------------
//
// These four are module-level and exported, not closures inside
// createSyncServer, for the same reason validateOpBatch below already is: they
// are the decisions worth testing, and while they lived in the closure the only
// way to reach them was to boot a real TCP listener and drive a socket. That is
// why 63 of this module's 76 tests start a server. Nothing here touches
// req/res or the options bag — the handlers stay responsible for HTTP, and
// these answer the security questions.

/** SHA-256 both sides first: crypto.timingSafeEqual throws on a length
 *  mismatch rather than just returning false, and a wrong-length guess
 *  is exactly the case a timing-safe compare exists to not leak — hashing
 *  first makes both inputs a fixed 32 bytes before the constant-time
 *  comparison ever runs. */
function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest())
}

/** True when any presented value matches `candidate`. False when `candidate`
 *  itself is unset — a candidate that does not exist cannot be matched,
 *  deliberately distinct from "nothing was required at all", which is
 *  isTokenAuthorized's question, not this one. */
export function tokenMatches(presented: readonly (string | null)[], candidate: string | undefined): boolean {
  if (!candidate) return false
  return presented.some((value) => value !== null && safeEqual(value, candidate))
}

/**
 * WHICH tier this request presented, or null when it presented none (or
 * neither is configured) — the tri-state validateOpBatch's security-store gate
 * needs, to require specifically the admin one. Unlike isTokenAuthorized, this
 * can never be satisfied by there being nothing to check: an unset token option
 * is simply not matchable, so a shop with no token configured yet answers null
 * here even though isTokenAuthorized would let the same request through —
 * exactly the gap validateOpBatch's check exists to close for security-store
 * ops during the pre-account bootstrap window.
 */
export function tokenRole(
  presented: readonly (string | null)[],
  adminToken: string | undefined,
  workerToken: string | undefined
): 'admin' | 'worker' | null {
  if (tokenMatches(presented, adminToken)) return 'admin'
  if (tokenMatches(presented, workerToken)) return 'worker'
  return null
}

/** True if this request is allowed through. Always true when NEITHER token is
 *  configured — the pre-account bootstrap window (see server/shopToken.ts).
 *  Otherwise true when EITHER tier's token was presented: a worker-paired
 *  device still needs ordinary read/write sync access, which is the whole
 *  reason its account exists — only validateOpBatch's security-store check
 *  tells the two tokens apart. */
export function isTokenAuthorized(
  presented: readonly (string | null)[],
  adminToken: string | undefined,
  workerToken: string | undefined
): boolean {
  if (!adminToken && !workerToken) return true
  return tokenMatches(presented, adminToken) || tokenMatches(presented, workerToken)
}

/**
 * Which account these credentials authenticate as, or null.
 *
 * Role-aware matching, not a flat exact-match find() — an admin candidate is
 * matched via adminUsernameMatches (src/lib/auth/username.ts), the SAME lenient
 * rule src/store/authStore.ts's signIn and signInAsAdmin already apply: a null
 * username on the admin account (a real, deliberately-supported legacy state —
 * see securityStore.ts's adminUsername doc) matches ANY typed username, so that
 * account is never permanently unreachable through this route just because it
 * has no recorded name. Worker keeps exact matching — setWorkerAccount always
 * writes both halves together, so there is no equivalent legacy state.
 *
 * The password is verified even when no account matched, against a hash that
 * cannot succeed, so a bad username and a bad password cost the same wall time.
 * Skipping the derivation for an unknown name would answer in ~0ms instead of
 * ~20ms and turn this route into a username oracle. `verify` is injectable only
 * so a test can assert that equal-cost property without waiting on real PBKDF2.
 */
export function authenticateLogin(
  accounts: readonly ShopAccount[],
  username: string,
  password: string,
  verify: (password: string, hash: string) => boolean = verifyPasswordHash
): ShopAccount | null {
  const wanted = username.trim().toLowerCase()
  const account = accounts.find((a) =>
    a.role === 'admin' ? adminUsernameMatches(a.username, username) : a.username?.trim().toLowerCase() === wanted
  )
  if (!account) {
    verify(password, DUMMY_HASH)
    return null
  }
  return verify(password, account.passwordHash) ? account : null
}


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
  allowedEntitySet: Set<string> | null,
  /**
   * WHICH token this caller presented on THIS request, or null — see
   * createSyncServer's presentedTokenRole, which (unlike isAuthorized)
   * answers null rather than “allowed” when no token is configured at all,
   * so this can't be satisfied by there simply being nothing to check.
   *
   * Gates ops whose entity is 'security-store' specifically, and requires
   * the token to have been the ADMIN-tier one — not merely “a valid token,
   * any tier”. That store is deliberately included in allowedEntities (see
   * electron/main.ts / server/index.ts’s allowedEntities:
   * PERSISTED_STORES.map(...)) so an authenticated ADMIN device can push a
   * password change or LAN-token rotation exactly like any other synced
   * store — but a device that only ever proved it holds the WORKER
   * password must not be able to, or a credential deliberately handed to
   * shop-floor staff (see src/store/securityStore.ts’s workerLanToken doc)
   * reaches the same trust tier as the admin one. This is also still what
   * closes the separate pre-account bootstrap window: before any admin
   * account exists, server/shopToken.ts's readShopToken has nothing to
   * demand, so isAuthorized lets everything through — without this extra
   * check, anyone on the shop's WiFi could push a security-store upsert in
   * that window and hand themselves the admin password with zero
   * credentials. Defaults to 'admin' so every caller/test pushing a
   * non-security-store entity (everything today except this one deliberate
   * case) is unaffected.
   */
  presentedTokenRole: 'admin' | 'worker' | null = 'admin'
): { index: number; reason: string }[] {
  const rejected: { index: number; reason: string }[] = []
  parsed.forEach((op: unknown, index: number) => {
    if (!isOpRow(op)) {
      rejected.push({ index, reason: 'malformed op' })
    } else if (allowedEntitySet && !allowedEntitySet.has(op.entity)) {
      rejected.push({ index, reason: `entity not allowed: ${op.entity}` })
    } else if (op.entity === 'security-store' && presentedTokenRole !== 'admin') {
      rejected.push({ index, reason: 'security-store requires a valid admin shop token' })
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
  let urlPath: string
  try {
    // decodeURIComponent throws SyntaxError/URIError on a malformed escape
    // (a bare `GET /%` is enough) — a synchronous throw here used to
    // propagate straight out of this function, out of the async request
    // listener below with nothing catching it, and crash the whole Node
    // process. One anonymous request from anywhere on the LAN could take
    // the shop's running app down. Answer 400 instead — the outer
    // try/catch on the request listener (see createSyncServer) is the
    // second, more general net for whatever this one doesn't anticipate.
    urlPath = decodeURIComponent((req.url as string).split('?')[0])
  } catch {
    res.writeHead(400)
    res.end()
    return
  }
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
  const { db, distDir, token, workerToken, getShopName, allowedEntities, isSyncableKey, getAccounts, getLanToken } = options
  const allowedEntitySet = allowedEntities ? new Set(allowedEntities) : null
  const loginRateLimiter = createLoginRateLimiter()
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

  /** Resolves either token option to its current value — pulled out once
   *  both `token` and `workerToken` need the identical getter-or-string
   *  handling the old inline `typeof token === 'function' ? token() : token`
   *  used to repeat twice for one token; now it repeats for two. */
  function resolveToken(t: string | (() => string | undefined) | undefined): string | undefined {
    return typeof t === 'function' ? t() : t
  }

  /** Every place a caller may present the token: the `x-shop-token` header for
   *  ordinary calls, and the `?token=` query param for SSE, which can't set
   *  headers. Pulling the two off the request is all this does — deciding what
   *  they mean is tokenRole/isTokenAuthorized above. */
  function presentedTokens(req: http.IncomingMessage, url: URL): (string | null)[] {
    const header = req.headers['x-shop-token']
    return [typeof header === 'string' ? header : null, url.searchParams.get('token')]
  }

  /** True if this request is allowed through. Always true when NEITHER
   *  token option is configured — the pre-account bootstrap window (see
   *  server/shopToken.ts). Otherwise true when the request presented
   *  EITHER the admin-tier or the worker-tier token: a worker-paired
   *  device still needs ordinary read/write sync access, which is the
   *  whole reason its account exists — only validateOpBatch's
   *  security-store check (below) tells the two tokens apart. Resolves
   *  both getters fresh on every call, so a token that starts being
   *  required mid-run (see the `token` option's doc comment) takes effect
   *  immediately, not just for connections opened after a restart. */
  function isAuthorized(req: http.IncomingMessage, url: URL): boolean {
    return isTokenAuthorized(presentedTokens(req, url), resolveToken(token), resolveToken(workerToken))
  }

  /** This request's tier — see tokenRole above, which owns the rule. Resolves
   *  both getters fresh on every call, so a token that starts being required
   *  mid-run takes effect immediately (see the `token` option's doc). */
  function presentedTokenRole(req: http.IncomingMessage, url: URL): 'admin' | 'worker' | null {
    return tokenRole(presentedTokens(req, url), resolveToken(token), resolveToken(workerToken))
  }

  /**
   * Sign in with one of the shop's own account credentials and leave holding
   * the LAN token, so pairing a new device never needs anyone to read a
   * generated token off one screen and type it into another.
   *
   * Deliberately exempt from the /api/* token gate above — requiring the
   * token to ask for the token is the circular lock this route exists to
   * open. Every other protection still applies: the Host allowlist runs
   * first, the response is identical for "no such username" and "wrong
   * password" (so this can't be used to enumerate account names), and
   * repeated failures from one address back off on the schedule in
   * server/loginRateLimit.ts.
   *
   * Usernames are compared case-insensitively and trimmed — the shop typed
   * this into a phone-keyboard on a tablet, and "Budi " failing against
   * "budi" is a support call, not a security boundary. The password is not
   * treated that way and is compared exactly.
   */
  async function handleLogin(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    cors: Record<string, string>
  ): Promise<void> {
    const contentType = req.headers['content-type']
    if (typeof contentType !== 'string' || !contentType.toLowerCase().startsWith('application/json')) {
      sendJson(res, 415, { error: 'expected application/json' }, cors)
      return
    }

    // socket.remoteAddress, never a forwarded header: this server sits
    // directly on the shop LAN with no proxy in front of it, so an
    // X-Forwarded-For here would be attacker-controlled and would let one
    // address wear a fresh identity per guess, defeating the limiter.
    const rateKey = req.socket.remoteAddress ?? 'unknown'
    const limit = loginRateLimiter.check(rateKey)
    if (!limit.allowed) {
      sendJson(res, 429, { error: 'too many attempts', retryAfterMs: limit.retryAfterMs }, cors)
      return
    }

    let username: string
    let password: string
    try {
      const parsed = JSON.parse(await readRequestBody(req))
      if (typeof parsed?.username !== 'string' || typeof parsed?.password !== 'string') {
        sendJson(res, 400, { error: 'expected {username, password}' }, cors)
        return
      }
      username = parsed.username
      password = parsed.password
    } catch (e) {
      if (e instanceof RequestTooLargeError) {
        sendJson(res, 413, { error: 'request body too large' }, cors)
      } else {
        sendJson(res, 400, { error: String(e) }, cors)
      }
      return
    }

    // The credential decision — role-aware matching, and the unknown-username
    // path costing the same wall time as a wrong password — is
    // authenticateLogin above. What is left here is HTTP: rate-limit
    // accounting and shaping the response.
    const account = authenticateLogin(getAccounts?.() ?? [], username, password)

    if (!account) {
      loginRateLimiter.recordFailure(rateKey)
      const after = loginRateLimiter.check(rateKey)
      sendJson(res, 401, { error: 'invalid credentials', retryAfterMs: after.retryAfterMs }, cors)
      return
    }

    loginRateLimiter.recordSuccess(rateKey)
    sendJson(
      res,
      200,
      {
        ok: true,
        role: account.role,
        username: account.username,
        token: getLanToken?.(account.role) ?? null,
        shopName: getShopName?.() ?? null,
        seq: db.currentMaxSeq(),
      },
      cors
    )
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

  async function handleOpsPost(
    req: http.IncomingMessage,
    url: URL,
    res: http.ServerResponse,
    cors: Record<string, string>
  ): Promise<void> {
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
      const rejected = validateOpBatch(parsed, allowedEntitySet, presentedTokenRole(req, url))
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
    try {
      await handleRequest(req, res)
    } catch (err) {
      // The last-resort net. A synchronous throw or a rejected await
      // anywhere below used to propagate out of this listener entirely —
      // an unhandled rejection in an async http.createServer callback
      // terminates the whole Node process (Electron's main process, on
      // that deployment), from one malformed request, from anyone who can
      // reach the port. serveStaticFile's decodeURIComponent used to be
      // exactly that hole; this catch is what keeps the NEXT one from
      // being the same kind of outage instead of a 500.
      console.error('Unhandled error handling request:', err)
      if (!res.headersSent) {
        res.writeHead(500)
        res.end()
      } else {
        res.end()
      }
    }
  })

  async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
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

    // /api/login is the one /api/* route the token gate must not cover:
    // its entire purpose is to hand the token to a device that doesn't have
    // it yet, so requiring the token to reach it would be circular. It runs
    // its own credential check and its own per-address backoff instead — see
    // handleLogin. Everything upstream of here (the Host allowlist, CORS)
    // has already applied.
    const isLoginRoute = url.pathname === '/api/login'
    if (url.pathname.startsWith('/api/') && !isLoginRoute && !isAuthorized(req, url)) {
      sendJson(res, 401, { error: 'unauthorized' }, cors)
      return
    }

    // Only offered when a deployment actually wired accounts up; otherwise
    // this falls through to the 404 below, so a host with no account support
    // never advertises a login that could not succeed.
    if (isLoginRoute && req.method === 'POST' && getAccounts) {
      await handleLogin(req, res, cors)
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
      await handleOpsPost(req, url, res, cors)
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
  }

  return {
    server,
    close() {
      for (const client of sseClients) client.end()
      server.close()
    },
  }
}
