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

  // This is the defense-in-depth half of the LAN-takeover fix: even during
  // the pre-account bootstrap window, where server/shopToken.ts's
  // readShopToken has nothing to demand and isAuthorized therefore lets
  // everything through, a security-store op still needs an actually-
  // presented, actually-valid token — not just "the gate happens to be
  // open" — or anyone on the WiFi in that window could push themselves the
  // shop's admin password.
  describe('security-store requires a presented ADMIN token', () => {
    it('rejects a security-store op when no token was presented at all', () => {
      const rejected = validateOpBatch([op({ entity: 'security-store' })], null, null)
      expect(rejected).toEqual([{ index: 0, reason: 'security-store requires a valid admin shop token' }])
    })

    it('accepts a security-store op when the ADMIN token was presented', () => {
      expect(validateOpBatch([op({ entity: 'security-store' })], null, 'admin')).toEqual([])
    })

    it('rejects a security-store op when only the WORKER token was presented, the actual fix', () => {
      // A worker credential must not reach the same trust tier as the
      // admin one, see this parameter's doc for the vulnerability this
      // closes.
      const rejected = validateOpBatch([op({ entity: 'security-store' })], null, 'worker')
      expect(rejected).toEqual([{ index: 0, reason: 'security-store requires a valid admin shop token' }])
    })

    it('defaults to admin, so every other entity/test call site above is unaffected', () => {
      // No third argument at all — matches every call site above.
      expect(validateOpBatch([op({ entity: 'security-store' })], null)).toEqual([])
    })

    it('does not gate any OTHER entity on presentedTokenRole', () => {
      expect(validateOpBatch([op({ entity: 'customer-store' })], null, null)).toEqual([])
    })
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

  it('also accepts the WORKER token for ordinary /api/* access — only security-store ops single it out', async () => {
    // isAuthorized itself doesn't distinguish the two tiers — a worker-paired
    // device still needs ordinary sync access, which is the whole reason its
    // account exists. See the "POST /api/ops — security-store requires..."
    // describe block for the entity-specific check that DOES tell them apart.
    await start({ token: 'admin-secret', workerToken: 'worker-secret' })
    const res = await fetch(`${baseUrl}/api/info`, { headers: { 'x-shop-token': 'worker-secret' } })
    expect(res.status).toBe(200)
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

// The end-to-end reproduction of the LAN takeover this session found and
// fixed: with the gate open (server/shopToken.ts's readShopToken, matching
// the shop's real shipping default before this fix — an account exists but
// lanTokenRequired is off), a security-store op used to be accepted from
// ANY caller with zero credentials, silently rewriting the shop's admin
// password. Fixed at the HTTP layer here — see the 'security-store requires
// a presented token' block above for the same fix at the validateOpBatch
// unit level.
describe('POST /api/ops — security-store requires a real token, gate or no gate (the takeover fix)', () => {
  function post(ops: unknown[], headers: Record<string, string> = {}) {
    return fetch(`${baseUrl}/api/ops`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(ops),
    })
  }

  it('rejects a security-store op from a caller presenting no token at all', async () => {
    // No token configured on this server — isAuthorized alone would let this
    // straight through, which is exactly the hole. presentedTokenRole must
    // independently say "no" here.
    await start({ allowedEntities: ['security-store'] })
    const res = await post([op({ entity: 'security-store' })])
    expect(res.status).toBe(400)
    const body = await json(res)
    expect(body.rejected).toEqual([{ index: 0, reason: 'security-store requires a valid admin shop token' }])
  })

  it('accepts a security-store op once a valid ADMIN token is actually presented', async () => {
    await start({ allowedEntities: ['security-store'], token: 'shop-secret' })
    const res = await post([op({ entity: 'security-store' })], { 'x-shop-token': 'shop-secret' })
    expect(res.status).toBe(200)
  })

  it('rejects a security-store op presenting a valid WORKER token — the Fix 3 regression', async () => {
    // The actual vulnerability: before this fix, ANY valid token (worker or
    // admin) satisfied this gate, so a device that paired with the shop's
    // WORKER password could rewrite the admin account. isAuthorized alone
    // would let this request through (a worker token is one of the two
    // configured tokens); only this entity-specific, role-specific check
    // stops the write.
    await start({ allowedEntities: ['security-store'], token: 'admin-secret', workerToken: 'worker-secret' })
    const res = await post([op({ entity: 'security-store' })], { 'x-shop-token': 'worker-secret' })
    expect(res.status).toBe(400)
    const body = await json(res)
    expect(body.rejected).toEqual([{ index: 0, reason: 'security-store requires a valid admin shop token' }])
  })

  it('a worker token still authorizes an ORDINARY entity — workers keep syncing normally', async () => {
    await start({ allowedEntities: ['customer-store'], token: 'admin-secret', workerToken: 'worker-secret' })
    const res = await post([op({ entity: 'customer-store' })], { 'x-shop-token': 'worker-secret' })
    expect(res.status).toBe(200)
  })

  it('rejects a security-store op even with the gate fully open (no token configured at all)', async () => {
    // The bootstrap-window case: readShopToken returns undefined (nothing to
    // demand) because the shop genuinely has no account yet. isAuthorized
    // says "allowed" for everything here — the extra check is the only
    // thing standing between that and an unauthenticated credential write.
    await start({ allowedEntities: ['security-store'] })
    const res = await post([op({ entity: 'security-store' })])
    expect(res.status).toBe(400)
  })

  it('a non-security-store op is unaffected by having no token', async () => {
    await start({ allowedEntities: ['customer-store'] })
    const res = await post([op({ entity: 'customer-store' })])
    expect(res.status).toBe(200)
  })
})

// serveStaticFile's decodeURIComponent throws on a malformed escape (a bare
// `GET /%` is enough) — this used to propagate out of the async request
// listener with nothing catching it, and an unhandled rejection there kills
// the whole Node process. On the Electron deployment that's the shop's
// entire running app, from one anonymous request, repeatably. The second
// assertion in each case — that the server is still answering afterwards —
// is the actual regression test; a 400 with a dead server behind it would
// still be a five-alarm bug.
describe('serveStaticFile — malformed URL does not crash the server (Fix: GET /%)', () => {
  it('answers 400 for a bare "%" and the server survives to answer the next request', async () => {
    await start({ distDir: __dirname })
    const bad = await fetch(`${baseUrl}/%`)
    expect(bad.status).toBe(400)

    const next = await fetch(`${baseUrl}/api/info`)
    expect(next.status).toBe(200)
  })

  it('a null-byte escape is caught by the OUTER net instead — still no crash', async () => {
    // %00 decodes cleanly (decodeURIComponent has no objection to a null
    // character), so this one slips past serveStaticFile's own try/catch and
    // only throws later, inside fs.readFile, which Node refuses outright for
    // a path containing a null byte. That is precisely the case the second,
    // whole-listener try/catch in createSyncServer exists for — answered as
    // 500 rather than 400, but the point is identical: a response, not a
    // dead process.
    await start({ distDir: __dirname })
    const bad = await fetch(`${baseUrl}/%00`)
    expect(bad.status).toBe(500)

    const next = await fetch(`${baseUrl}/api/info`)
    expect(next.status).toBe(200)
  })

  it('the outer request-listener catch is a second net: any other unexpected throw answers 500, not a dead process', async () => {
    // getShopName throwing is a stand-in for "some other bug reaches this
    // point unexpectedly" — the specific trigger doesn't matter; what matters
    // is that createSyncServer's try/catch around the whole listener turns it
    // into a response instead of an unhandled rejection that would take the
    // process down.
    await start({
      getShopName: () => {
        throw new Error('boom')
      },
    })
    const first = await fetch(`${baseUrl}/api/info`)
    expect(first.status).toBe(500)

    // Fired again to prove the server is still alive and the listener is
    // still attached — an unhandled rejection would have killed the process
    // after the first request, and this second fetch would simply fail to
    // connect.
    const second = await fetch(`${baseUrl}/api/info`)
    expect(second.status).toBe(500)
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

// POST /api/login — the route that lets a new device pair with the shop's
// own username and password instead of a transcribed LAN token. It is the
// one /api/* path deliberately NOT behind the token gate (requiring the
// token to fetch the token would be circular), so most of what matters here
// is that everything else still holds it shut.
describe('POST /api/login', () => {
  // A real hash for 'rahasia1', produced by src/lib/auth/password.ts and
  // pasted in rather than derived at test time: 210k PBKDF2 rounds per
  // hash would dominate this file's runtime, and
  // server/__tests__/passwordVerify.test.ts already proves the two
  // implementations agree on freshly generated hashes.
  const ADMIN_HASH = 'pbkdf2$sha256$210000$9cBPRgAESJlmTjf1dUKEOw==$pM48/AHEi49RkH2sz3GxNyCBBphbn79mWh5scwHcy2c='

  const accounts = () => [{ role: 'admin' as const, username: 'Budi', passwordHash: ADMIN_HASH }]

  function post(body: unknown, headers: Record<string, string> = {}) {
    return fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    })
  }

  it('accepts the right credentials and returns the role', async () => {
    await start({ getAccounts: accounts })
    const res = await post({ username: 'Budi', password: 'rahasia1' })
    expect(res.status).toBe(200)
    const body = await json(res)
    expect(body.ok).toBe(true)
    expect(body.role).toBe('admin')
    expect(body.username).toBe('Budi')
  })

  it('hands back the shop token, so nobody has to transcribe it', async () => {
    await start({ getAccounts: accounts, getLanToken: () => 'abcd-efgh-jkmn' })
    const body = await json(await post({ username: 'Budi', password: 'rahasia1' }))
    expect(body.token).toBe('abcd-efgh-jkmn')
  })

  it('calls getLanToken with the MATCHED role, so an admin login and a worker login hand back different tokens', async () => {
    // Fix 3's actual wiring: getLanToken must be called with account.role,
    // not with no argument — a worker login handing back the admin token
    // would be exactly the vulnerability this fix closes.
    const both = () => [
      { role: 'admin' as const, username: 'Budi', passwordHash: ADMIN_HASH },
      { role: 'worker' as const, username: 'bengkel', passwordHash: ADMIN_HASH },
    ]
    await start({ getAccounts: both, getLanToken: (role) => (role === 'admin' ? 'admin-tok' : 'worker-tok') })
    const adminBody = await json(await post({ username: 'Budi', password: 'rahasia1' }))
    expect(adminBody.token).toBe('admin-tok')
    const workerBody = await json(await post({ username: 'bengkel', password: 'rahasia1' }))
    expect(workerBody.token).toBe('worker-tok')
  })

  it('matches the username case-insensitively but the password exactly', async () => {
    await start({ getAccounts: accounts })
    expect((await post({ username: 'budi', password: 'rahasia1' })).status).toBe(200)
    expect((await post({ username: '  BUDI  ', password: 'rahasia1' })).status).toBe(200)
    expect((await post({ username: 'Budi', password: 'Rahasia1' })).status).toBe(401)
  })

  it('rejects a wrong password', async () => {
    await start({ getAccounts: accounts })
    expect((await post({ username: 'Budi', password: 'wrong' })).status).toBe(401)
  })

  it('regression: signs in an admin account with no recorded username, with ANY typed username', async () => {
    // The exact bug: server/shopAccounts.ts used to exclude an admin
    // account entirely once adminUsername was null, so this account could
    // never pair a second device no matter how correct the password was —
    // matching src/store/authStore.ts's identical, already-fixed signIn bug.
    // adminUsernameMatches (src/lib/auth/username.ts) is what makes a null
    // username match anything typed; this proves handleLogin actually calls
    // through it rather than reimplementing its own stricter comparison.
    const legacyAdmin = () => [{ role: 'admin' as const, username: null, passwordHash: ADMIN_HASH }]
    await start({ getAccounts: legacyAdmin })
    for (const typed of ['Budi', 'anything', '']) {
      const res = await post({ username: typed, password: 'rahasia1' })
      expect(res.status).toBe(200)
      expect((await json(res)).role).toBe('admin')
    }
  })

  it('does NOT extend the same leniency to a worker account with no recorded username', async () => {
    // Unlike admin, a worker account never legitimately has a null username
    // (setWorkerAccount always writes both halves together) — this checks
    // handleLogin's own matching rule directly, independent of whether
    // readShopAccounts could ever actually produce this shape.
    const unnamedWorker = () => [{ role: 'worker' as const, username: null, passwordHash: ADMIN_HASH }]
    await start({ getAccounts: unnamedWorker })
    expect((await post({ username: 'anything', password: 'rahasia1' })).status).toBe(401)
  })

  it('answers an unknown username exactly as it answers a wrong password', async () => {
    // No username oracle: the status and the body must not distinguish the
    // two, or anyone on the WiFi can enumerate the shop's account names.
    await start({ getAccounts: accounts })
    const unknown = await post({ username: 'nobody', password: 'rahasia1' })
    const wrongPw = await post({ username: 'Budi', password: 'wrong' })
    expect(unknown.status).toBe(wrongPw.status)
    expect(await json(unknown)).toEqual(await json(wrongPw))
  })

  it('rejects every login when the shop has no accounts yet', async () => {
    await start({ getAccounts: () => [] })
    expect((await post({ username: 'Budi', password: 'rahasia1' })).status).toBe(401)
  })

  it('is reachable without the shop token — that is the whole point', async () => {
    // Every other /api/* route 401s without the token here; this one must
    // not, or a device with no token could never obtain one.
    await start({ getAccounts: accounts, token: 'shop-secret', getLanToken: () => 'shop-secret' })
    expect((await fetch(`${baseUrl}/api/info`)).status).toBe(401)
    const res = await post({ username: 'Budi', password: 'rahasia1' })
    expect(res.status).toBe(200)
    expect((await json(res)).token).toBe('shop-secret')
  })

  it('404s when the deployment wired up no accounts at all', async () => {
    // Distinct from "no accounts exist yet" above: a host with no
    // getAccounts should not advertise a login route at all.
    await start()
    expect((await post({ username: 'Budi', password: 'rahasia1' })).status).toBe(404)
  })

  it('backs off after repeated failures from the same address', async () => {
    await start({ getAccounts: accounts })
    for (let i = 0; i < 4; i++) await post({ username: 'Budi', password: 'wrong' })
    const res = await post({ username: 'Budi', password: 'wrong' })
    expect(res.status).toBe(429)
    expect((await json(res)).retryAfterMs).toBeGreaterThan(0)
  })

  it('throttles even a CORRECT password once the address is locked out', async () => {
    // The check has to run before verification, not after — otherwise the
    // backoff is trivially bypassed by whoever eventually guesses right.
    await start({ getAccounts: accounts })
    for (let i = 0; i < 4; i++) await post({ username: 'Budi', password: 'wrong' })
    expect((await post({ username: 'Budi', password: 'rahasia1' })).status).toBe(429)
  })

  it('requires application/json, keeping it off the CORS simple-request list', async () => {
    await start({ getAccounts: accounts })
    const res = await fetch(`${baseUrl}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ username: 'Budi', password: 'rahasia1' }),
    })
    expect(res.status).toBe(415)
  })

  it('rejects a body that is not {username, password}', async () => {
    await start({ getAccounts: accounts })
    expect((await post({ username: 'Budi' })).status).toBe(400)
    expect((await post({ username: 123, password: 'x' })).status).toBe(400)
    expect((await post([])).status).toBe(400)
  })

  it('still enforces the Host allowlist', async () => {
    // Being exempt from the token gate must not make this exempt from the
    // DNS-rebinding guard that runs ahead of everything.
    await start({ getAccounts: accounts })
    const port = (server.server.address() as { port: number }).port
    const status = await new Promise<number>((resolve, reject) => {
      const req = http.request(
        { host: '127.0.0.1', port, path: '/api/login', method: 'POST', headers: { Host: 'evil.example.com', 'Content-Type': 'application/json' } },
        (res) => {
          res.resume()
          resolve(res.statusCode ?? 0)
        }
      )
      req.on('error', reject)
      req.end(JSON.stringify({ username: 'Budi', password: 'rahasia1' }))
    })
    expect(status).toBe(400)
  })
})
