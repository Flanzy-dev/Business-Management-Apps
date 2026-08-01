import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as http from 'http'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { createSyncServer, type SyncServer, type SyncServerOptions } from '../syncServer'
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
})

describe('/api/info', () => {
  it('reports the shop name and current seq', async () => {
    await start({ getShopName: () => 'Surya Baru Test Shop' })
    const body = await json(await fetch(`${baseUrl}/api/info`))
    expect(body).toEqual({ ok: true, shopName: 'Surya Baru Test Shop', seq: 0 })
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
})
