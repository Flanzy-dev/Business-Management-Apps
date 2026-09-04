import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as http from 'http'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { createSyncServer, validateOpBatch, type SyncServer, type SyncServerOptions } from '../syncServer'
import { readShopName } from '../shopName'
import type { SyncDatabase, OpRow } from '../db'

/** In-memory fake — db.ts's own SyncDatabase behavior (idempotency, seq
 *  ordering, real sql.js) is covered by server/__tests__/db.test.ts; this
 *  file is about the HTTP/SSE layer wrapped around whatever implements the
 *  interface. */
function createFakeDb(): SyncDatabase {
  const kv = new Map<string, string>()
  const ops: (OpRow & { seq: number })[] = []
  let seq = 0
  return {
    getItem: (k) => (kv.has(k) ? kv.get(k)! : null),
    setItem: (k, v) => { kv.set(k, v) },
    removeItem: (k) => { kv.delete(k) },
    opsInsertOne: (op) => {
      const existing = ops.find((o) => o.id === op.id)
      if (existing) return existing.seq
      seq += 1
      ops.push({ ...op, seq })
      return seq
    },
    opsSince: (since) => ops.filter((o) => o.seq > since),
    snapshot: () => Object.fromEntries(kv),
    currentMaxSeq: () => seq,
    materializeOps: (batch) => {
      for (const op of batch) kv.set(op.entity, JSON.stringify({ id: op.entityId, kind: op.kind }))
    },
    persist: () => {},
    getLastPersistError: () => null,
  }
}

let server: SyncServer
let baseUrl: string

// Node's global fetch typings (server tests run under tsconfig.server.json,
// which has no "DOM" lib) type Response.json() as Promise<unknown> rather
// than the DOM lib's Promise<any> — a deliberately stricter default. Every
// call site here wants the parsed body's shape without re-declaring it, so
// one cast lives here instead of scattered `as any`s at each call.
async function json<T = any>(res: Response): Promise<T> {
  return (await res.json()) as T
}

function start(options: Partial<SyncServerOptions> = {}): Promise<void> {
  server = createSyncServer({ db: createFakeDb(), ...options })
  return new Promise((resolve) => {
    server.server.listen(0, '127.0.0.1', () => {
      const address = server.server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      baseUrl = `http://127.0.0.1:${port}`
      resolve()
    })
  })
}

afterEach(() => {
  server?.close()
})

function op(overrides: Partial<OpRow> = {}): OpRow {
  return {
    id: 'op-1',
    device: 'dev-a',
    entity: 'customer-store',
    field: 'customers',
    entityId: 'c1',
    kind: 'upsert',
    payload: '{}',
    ts: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

// Pure, no HTTP round trip — pulled out of the POST /api/ops handler
// (syncServer.ts's complexity cleanup) specifically so this became testable
// on its own for the first time.
describe('validateOpBatch', () => {
  it('accepts a well-formed batch', () => {
    expect(validateOpBatch([op(), op({ id: 'op-2' })], null)).toEqual([])
  })

  it('rejects a malformed op by index', () => {
    const rejected = validateOpBatch([op(), { id: 'not-an-op' }], null)
    expect(rejected).toEqual([{ index: 1, reason: 'malformed op' }])
  })

  it('rejects an op whose entity is outside the allow-list', () => {
    const rejected = validateOpBatch([op({ entity: 'sync-host' })], new Set(['customer-store']))
    expect(rejected).toEqual([{ index: 0, reason: 'entity not allowed: sync-host' }])
  })

  it('accepts any entity when no allow-list is given', () => {
    expect(validateOpBatch([op({ entity: 'sync-host' })], null)).toEqual([])
  })

  it('rejects an upsert/append op whose payload is not valid JSON', () => {
    const rejected = validateOpBatch([op({ kind: 'upsert', payload: 'not json' })], null)
    expect(rejected).toEqual([{ index: 0, reason: 'payload is not valid JSON' }])
  })

  it('never JSON-validates a delete op — its payload is always empty, not JSON', () => {
    expect(validateOpBatch([op({ kind: 'delete', payload: '' })], null)).toEqual([])
  })

  it('checks every op before any is reported, so a batch reports all failures at once', () => {
    const rejected = validateOpBatch(
      [op({ payload: 'bad' }), { id: 'nope' }, op({ id: 'op-3', entity: 'sync-host' })],
      new Set(['customer-store'])
    )
    expect(rejected).toEqual([
      { index: 0, reason: 'payload is not valid JSON' },
      { index: 1, reason: 'malformed op' },
      { index: 2, reason: 'entity not allowed: sync-host' },
    ])
  })
})

describe('/api/ops POST — validation (Fix 3)', () => {
  it('accepts a well-formed op and returns its seq', async () => {
    await start()
    const res = await fetch(`${baseUrl}/api/ops`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([op()]),
    })
    expect(res.status).toBe(200)
    const body = await json(res)
    expect(body.seqs).toEqual([1])
  })

  it('rejects a malformed op with 400 and does not insert it', async () => {
    await start()
    const res = await fetch(`${baseUrl}/api/ops`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ id: 'op-1' }]), // missing every other required field
    })
    expect(res.status).toBe(400)
    const body = await json(res)
    expect(body.rejected).toEqual([{ index: 0, reason: 'malformed op' }])

    const since = await json(await fetch(`${baseUrl}/api/ops?since=0`))
    expect(since).toEqual([])
  })

  it('rejects an op for a non-allowlisted entity — the device-local-key leak this closes', async () => {
    await start({ allowedEntities: ['customer-store', 'vehicle-store'] })
    const res = await fetch(`${baseUrl}/api/ops`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([op({ entity: 'sync-host', field: 'sync-host', entityId: 'sync-host' })]),
    })
    expect(res.status).toBe(400)
    const body = await json(res)
    expect(body.rejected[0].reason).toContain('sync-host')
  })

  it('rejects the whole batch (not a partial accept) when one op in it is bad', async () => {
    await start({ allowedEntities: ['customer-store'] })
    const res = await fetch(`${baseUrl}/api/ops`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([op({ id: 'good' }), op({ id: 'bad', entity: 'sync-host' })]),
    })
    expect(res.status).toBe(400)
    const since = await json(await fetch(`${baseUrl}/api/ops?since=0`))
    expect(since).toEqual([]) // the good op wasn't inserted either
  })

  it('accepts anything when allowedEntities is omitted', async () => {
    await start()
    const res = await fetch(`${baseUrl}/api/ops`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([op({ entity: 'sync-host' })]),
    })
    expect(res.status).toBe(200)
  })

  // Regression coverage for the fix that pairs with src/lib/sync/
  // quarantine.ts: before this, a malformed payload passed isOpRow (payload
  // only had to be *a string*, never valid JSON) and was durably accepted
  // into the oplog — every device that ever pulled it threw inside
  // applyOpsToBlob's JSON.parse forever. Rejecting it here means it's never
  // accepted at all.
  it('rejects an op whose payload is not valid JSON, and never inserts it', async () => {
    await start()
    const res = await fetch(`${baseUrl}/api/ops`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([op({ kind: 'upsert', payload: 'not valid json' })]),
    })
    expect(res.status).toBe(400)
    const body = await json(res)
    expect(body.rejected[0].reason).toContain('JSON')

    const since = await json(await fetch(`${baseUrl}/api/ops?since=0`))
    expect(since).toEqual([])
  })

  it('never JSON-validates a delete op\'s payload — it is always the empty string, never JSON', async () => {
    await start()
    const res = await fetch(`${baseUrl}/api/ops`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([op({ kind: 'delete', payload: '' })]),
    })
    expect(res.status).toBe(200)
  })
})

describe('/api/snapshot — isSyncableKey (defense in depth for Fix 1)', () => {
  it('filters out keys the predicate rejects', async () => {
    await start({ isSyncableKey: (key) => key === 'customer-store' })
    await fetch(`${baseUrl}/api/ops`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([op({ entity: 'customer-store', field: 'customers', entityId: 'c1' })]),
    })
    const { data } = await json(await fetch(`${baseUrl}/api/snapshot`))
    expect(Object.keys(data)).toEqual(['customer-store'])
  })

  it('sends everything when isSyncableKey is omitted', async () => {
    const db = createFakeDb()
    db.setItem('device-id', 'host-device-id')
    server = createSyncServer({ db })
    await new Promise<void>((resolve) => {
      server.server.listen(0, '127.0.0.1', () => {
        const address = server.server.address()
        baseUrl = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`
        resolve()
      })
    })
    const { data } = await json(await fetch(`${baseUrl}/api/snapshot`))
    expect(data['device-id']).toBe('host-device-id')
  })
})

describe('auth', () => {
  it('rejects every /api/* call with 401 when no token is provided and one is required', async () => {
    await start({ token: 'shop-secret' })
    const res = await fetch(`${baseUrl}/api/info`)
    expect(res.status).toBe(401)
  })

  it('accepts the x-shop-token header', async () => {
    await start({ token: 'shop-secret' })
    const res = await fetch(`${baseUrl}/api/info`, { headers: { 'x-shop-token': 'shop-secret' } })
    expect(res.status).toBe(200)
  })

  it('accepts a ?token= query param (what EventSource has to use)', async () => {
    await start({ token: 'shop-secret' })
    const res = await fetch(`${baseUrl}/api/info?token=shop-secret`)
    expect(res.status).toBe(200)
  })

  it('rejects a wrong token', async () => {
    await start({ token: 'shop-secret' })
    const res = await fetch(`${baseUrl}/api/info`, { headers: { 'x-shop-token': 'wrong' } })
    expect(res.status).toBe(401)
  })

  it('is wide open when no token is configured — existing single-PC setups keep working', async () => {
    await start()
    const res = await fetch(`${baseUrl}/api/info`)
    expect(res.status).toBe(200)
  })

  it('rejects a prefix of the correct token, not just a wholly wrong one', async () => {
    await start({ token: 'shop-secret' })
    const res = await fetch(`${baseUrl}/api/info`, { headers: { 'x-shop-token': 'shop-secr' } })
    expect(res.status).toBe(401)
  })

  // The embedded Electron server is constructed once at app startup, long
  // before Settings > Security's "Require token on LAN" switch could be
  // flipped — a getter is how that switch takes effect without an app
  // restart (see electron/main.ts and server/index.ts, both of which pass
  // one). This is the same isAuthorized code path as the plain-string cases
  // above; these three exist to prove the getter form is actually re-read
  // per request, not captured once.
  describe('a token getter (not a plain string)', () => {
    it('is called fresh on every request, so toggling it mid-run takes effect immediately', async () => {
      let required = false
      await start({ token: () => (required ? 'shop-secret' : undefined) })

      const before = await fetch(`${baseUrl}/api/info`)
      expect(before.status).toBe(200)

      required = true
      const afterEnabled = await fetch(`${baseUrl}/api/info`)
      expect(afterEnabled.status).toBe(401)

      const withToken = await fetch(`${baseUrl}/api/info`, { headers: { 'x-shop-token': 'shop-secret' } })
      expect(withToken.status).toBe(200)
    })

    it('treats a getter returning undefined the same as no token configured', async () => {
      await start({ token: () => undefined })
      const res = await fetch(`${baseUrl}/api/info`)
      expect(res.status).toBe(200)
    })
  })
})

describe('/api/info', () => {
  it('reports the shop name and current seq', async () => {
    await start({ getShopName: () => 'Surya Baru Test Shop' })
    const body = await json(await fetch(`${baseUrl}/api/info`))
    expect(body).toEqual({ ok: true, shopName: 'Surya Baru Test Shop', seq: 0 })
  })

  // The cases above stub getShopName, so they never exercised the real
  // settings-store lookup both deployments inject — which read the persist
  // envelope one level too shallow and made every "Test connection" say
  // "Connected to —". These drive readShopName against a realistic row.
  it('reads the real shop name out of a settings-store envelope', async () => {
    const db = createFakeDb()
    db.setItem(
      'settings-store',
      JSON.stringify({ state: { settings: { shopName: 'Surya Baru' } }, version: 0 })
    )
    await start({ db, getShopName: () => readShopName(db) })
    const body = await json(await fetch(`${baseUrl}/api/info`))
    expect(body).toEqual({ ok: true, shopName: 'Surya Baru', seq: 0 })
  })

  it('reports a null shop name when settings-store has no name yet', async () => {
    const db = createFakeDb()
    await start({ db, getShopName: () => readShopName(db) })
    const body = await json(await fetch(`${baseUrl}/api/info`))
    expect(body).toEqual({ ok: true, shopName: null, seq: 0 })
  })
})

describe('/api/events — SSE broadcast', () => {
  it('pings connected clients when new ops are pushed', async () => {
    await start()

    const received: string[] = []
    const req = http.get(`${baseUrl}/api/events`, (res) => {
      res.on('data', (chunk) => received.push(chunk.toString('utf8')))
    })
    // Give the SSE connection a moment to register before pushing.
    await new Promise((resolve) => setTimeout(resolve, 50))

    await fetch(`${baseUrl}/api/ops`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([op()]),
    })
    await new Promise((resolve) => setTimeout(resolve, 50))

    req.destroy()
    expect(received.join('')).toContain('event: ops')
  })
})

describe('static file serving — path traversal guard', () => {
  let distDir: string

  beforeEach(() => {
    distDir = fs.mkdtempSync(path.join(os.tmpdir(), 'surya-baru-dist-'))
    fs.writeFileSync(path.join(distDir, 'index.html'), '<html>ok</html>')
  })

  afterEach(() => {
    fs.rmSync(distDir, { recursive: true, force: true })
  })

  it('serves index.html for the root path', async () => {
    await start({ distDir })
    const res = await fetch(`${baseUrl}/`)
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('ok')
  })

  it('falls back to index.html for an unknown client-route path (SPA routing)', async () => {
    await start({ distDir })
    const res = await fetch(`${baseUrl}/some/client/route`)
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('ok')
  })

  it('refuses a path that climbs out of distDir', async () => {
    await start({ distDir })
    const res = await fetch(`${baseUrl}/..%2f..%2f..%2fetc%2fpasswd`)
    expect([403, 404]).toContain(res.status)
  })

  it('stays ungated even when a token is required — a follower has to reach the screen that asks for it', async () => {
    await start({ distDir, token: 'shop-secret' })
    const res = await fetch(`${baseUrl}/`)
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('ok')
  })

  // Regression coverage for the boundary check that used to be a bare
  // `filePath.startsWith(distDir)` — a PREFIX check, not a boundary check.
  // distDir carries no trailing separator, so a sibling directory whose name
  // merely starts with distDir's own basename passed it. Reproduces the
  // real standalone deployment's layout (server/index.ts's defaults:
  // distDir = <deploy>/dist, the SQLite file lives in <deploy>/dist-server)
  // so this is the actual exploit, not a synthetic one.
  it('refuses a sibling directory that merely starts with the same prefix as distDir', async () => {
    const deployRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'surya-baru-deploy-'))
    const realDistDir = path.join(deployRoot, 'dist')
    fs.mkdirSync(realDistDir)
    fs.writeFileSync(path.join(realDistDir, 'index.html'), '<html>ok</html>')
    const siblingDir = path.join(deployRoot, 'dist-server')
    fs.mkdirSync(siblingDir)
    fs.writeFileSync(path.join(siblingDir, 'surya-baru.db'), 'SECRET DATABASE CONTENTS')

    await start({ distDir: realDistDir })
    try {
      const res = await fetch(`${baseUrl}/..%2fdist-server%2fsurya-baru.db`)
      expect(res.status).toBe(403)
      expect(await res.text()).not.toContain('SECRET')
    } finally {
      fs.rmSync(deployRoot, { recursive: true, force: true })
    }
  })
})

describe('CORS', () => {
  it('sends no Access-Control-Allow-Origin when the request has no Origin header (the ordinary same-origin case)', async () => {
    await start()
    const res = await fetch(`${baseUrl}/api/info`)
    expect(res.headers.get('access-control-allow-origin')).toBeNull()
  })

  it("echoes the caller's Origin back when its own host is itself a loopback/private-range address", async () => {
    await start()
    const res = await fetch(`${baseUrl}/api/info`, { headers: { Origin: baseUrl } })
    expect(res.headers.get('access-control-allow-origin')).toBe(baseUrl)
  })

  // Regression coverage for the actual bug report this fixed: pairing two
  // devices is inherently cross-origin (a tablet that loaded its app off
  // device A's address has to reach device B's to test/follow it) — those
  // two origins never match by construction, so gating on "matches THIS
  // request's own Host" silently broke every Test Connection / follow-a-
  // different-host call. The correct question is "is the caller ALSO some
  // device on this LAN," not "is the caller THIS exact device."
  it("echoes an Origin whose host is a DIFFERENT LAN address than this request's own Host — the device-pairing case", async () => {
    await start()
    const res = await fetch(`${baseUrl}/api/info`, { headers: { Origin: 'http://192.168.1.9:5174' } })
    expect(res.headers.get('access-control-allow-origin')).toBe('http://192.168.1.9:5174')
  })

  it('echoes the literal Origin: null an Electron file://-loaded renderer sends for any cross-origin fetch', async () => {
    await start()
    const res = await fetch(`${baseUrl}/api/info`, { headers: { Origin: 'null' } })
    expect(res.headers.get('access-control-allow-origin')).toBe('null')
  })

  it('sends no Access-Control-Allow-Origin for a foreign Origin — the wildcard this replaces would have allowed it', async () => {
    await start()
    const res = await fetch(`${baseUrl}/api/info`, { headers: { Origin: 'https://evil.example.com' } })
    expect(res.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('rejects a non-JSON Content-Type on POST /api/ops, closing the CORS "simple request" write path', async () => {
    await start()
    const res = await fetch(`${baseUrl}/api/ops`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify([op()]),
    })
    expect(res.status).toBe(415)
    const since = await json(await fetch(`${baseUrl}/api/ops?since=0`))
    expect(since).toEqual([]) // nothing was inserted
  })

  // POST /api/ops always sends Content-Type: application/json
  // (src/lib/sync/client.ts's pushOps), which is never CORS-"simple" — so a
  // cross-origin push (the normal case: pairing two devices means their
  // origins never match) sends one of these first. With no route for it,
  // this fell through to the catch-all 404 with no CORS headers, and the
  // browser aborted before ever sending the real POST — Test Connection
  // could succeed while actual syncing silently never worked.
  describe('OPTIONS preflight', () => {
    it('answers with 204 and the headers a cross-origin POST /api/ops preflight needs', async () => {
      await start()
      const res = await fetch(`${baseUrl}/api/ops`, {
        method: 'OPTIONS',
        headers: { Origin: 'http://192.168.1.9:5174', 'Access-Control-Request-Method': 'POST' },
      })
      expect(res.status).toBe(204)
      expect(res.headers.get('access-control-allow-origin')).toBe('http://192.168.1.9:5174')
      expect(res.headers.get('access-control-allow-methods')).toContain('POST')
      const allowedHeaders = res.headers.get('access-control-allow-headers')?.toLowerCase() ?? ''
      expect(allowedHeaders).toContain('content-type')
      expect(allowedHeaders).toContain('x-shop-token')
    })

    it('is answered before the auth check — a preflight is never itself authorized', async () => {
      await start({ token: 'shop-secret' })
      const res = await fetch(`${baseUrl}/api/ops`, { method: 'OPTIONS' })
      expect(res.status).toBe(204)
    })

    it('still enforces the Host allowlist on a preflight, same as any other request', async () => {
      await start()
      const address = server.server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      const res = await new Promise<number>((resolve, reject) => {
        const req = http.request(
          { host: '127.0.0.1', port, path: '/api/ops', method: 'OPTIONS', headers: { Host: 'evil.example.com' } },
          (r) => {
            r.resume()
            resolve(r.statusCode ?? 0)
          }
        )
        req.on('error', reject)
        req.end()
      })
      expect(res).toBe(400)
    })
  })
})

describe('request body size cap', () => {
  it('rejects a POST /api/ops body over the size cap with 413 instead of buffering it all', async () => {
    await start()
    const oversized = JSON.stringify([op({ payload: 'x'.repeat(3 * 1024 * 1024) })])
    const res = await fetch(`${baseUrl}/api/ops`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: oversized,
    })
    expect(res.status).toBe(413)
  })
})

describe('Host header allowlist (DNS-rebinding guard)', () => {
  function requestWithHost(hostHeader: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const address = server.server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      const req = http.request(
        { host: '127.0.0.1', port, path: '/api/info', method: 'GET', headers: { Host: hostHeader } },
        (res) => {
          res.resume()
          resolve(res.statusCode ?? 0)
        }
      )
      req.on('error', reject)
      req.end()
    })
  }

  it('accepts a loopback/private-range Host, the only kind a real device ever sends', async () => {
    await start()
    expect(await requestWithHost('127.0.0.1:1')).toBe(200)
  })

  it('rejects a public-DNS-style Host — the shape a DNS-rebinding attack sends', async () => {
    await start()
    expect(await requestWithHost('evil.example.com')).toBe(400)
  })
})
