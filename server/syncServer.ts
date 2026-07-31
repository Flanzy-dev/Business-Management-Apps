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
import type { SyncDatabase, OpRow } from './db'

export interface SyncServerOptions {
  db: SyncDatabase
  /** Built app (`vite build`'s dist/) to serve to any device that just opens
   *  this server's URL in a browser — omit to run API-only. */
  distDir?: string
  /** Shared shop password. When set, every /api/* request must carry it via
   *  the `x-shop-token` header or (for the SSE route, which can't set
   *  headers) a `?token=` query param. */
  token?: string
  /** Read out of settings-store for the /api/info handshake, so a device
   *  can confirm it reached the shop it meant to before adopting this
   *  server's data — see src/pages/Settings.tsx's "Test connection". */
  getShopName?: () => string
}

function sendJson(res: http.ServerResponse, status: number, data: unknown): void {
  const body = JSON.stringify(data)
  res.writeHead(status, {
    'Content-Type': 'application/json',
    // A LAN-only tool for a single shop's own devices — CORS is opened wide
    // rather than pinned to an origin, since a device's origin is whatever
    // IP:port it happened to load this from.
    'Access-Control-Allow-Origin': '*',
  })
  res.end(body)
}

function readRequestBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
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

  // Guard against a path that climbs out of distDir (e.g. "/../..").
  if (!filePath.startsWith(distDir)) {
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
  const { db, distDir, token, getShopName } = options
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

  /** True if this request is allowed through — checks the header for
   *  ordinary calls and the query param for SSE (EventSource can't set
   *  headers). Always true when no token is configured. */
  function isAuthorized(req: http.IncomingMessage, url: URL): boolean {
    if (!token) return true
    const header = req.headers['x-shop-token']
    if (header === token) return true
    return url.searchParams.get('token') === token
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`)

    if (url.pathname.startsWith('/api/') && !isAuthorized(req, url)) {
      sendJson(res, 401, { error: 'unauthorized' })
      return
    }

    if (url.pathname === '/api/info' && req.method === 'GET') {
      sendJson(res, 200, { ok: true, shopName: getShopName?.() ?? null, seq: db.currentMaxSeq() })
      return
    }

    if (url.pathname === '/api/snapshot' && req.method === 'GET') {
      // Paired with `seq` so the caller (a device joining cold) knows exactly
      // which op it can start pulling *after* — see src/lib/sync/engine.ts.
      sendJson(res, 200, { data: db.snapshot(), seq: db.currentMaxSeq() })
      return
    }

    if (url.pathname === '/api/ops' && req.method === 'GET') {
      const since = parseInt(url.searchParams.get('since') || '0', 10) || 0
      sendJson(res, 200, db.opsSince(since))
      return
    }

    if (url.pathname === '/api/ops' && req.method === 'POST') {
      try {
        const body = await readRequestBody(req)
        const ops = JSON.parse(body)
        if (!Array.isArray(ops)) {
          sendJson(res, 400, { error: 'expected a JSON array of ops' })
          return
        }
        const seqs = ops.map((op: OpRow) => db.opsInsertOne(op))
        db.persist()
        broadcastOpsAvailable()
        sendJson(res, 200, { seqs })
      } catch (e) {
        sendJson(res, 400, { error: String(e) })
      }
      return
    }

    if (url.pathname === '/api/events' && req.method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      })
      res.write('\n')
      sseClients.push(res)
      req.on('close', () => {
        sseClients = sseClients.filter((client) => client !== res)
      })
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
