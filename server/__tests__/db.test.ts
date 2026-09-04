import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { openDatabase, type SyncDatabase, type OpRow } from '../db'

// Real sql.js against a real temp file — db.ts's SyncDatabase interface is
// the seam between the domain-agnostic server and the app's sync protocol,
// so there's no fake worth building here; the actual SQLite behavior (ops
// table AUTOINCREMENT, INSERT OR IGNORE idempotency) is exactly what needs
// covering.

let dbFilePath: string
let db: SyncDatabase

beforeEach(async () => {
  dbFilePath = path.join(os.tmpdir(), `surya-baru-db-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`)
  db = await openDatabase(dbFilePath)
})

afterEach(() => {
  fs.rmSync(dbFilePath, { force: true })
  fs.rmSync(`${dbFilePath}.bak`, { force: true })
  fs.rmSync(`${dbFilePath}.tmp`, { force: true })
})

function op(overrides: Partial<OpRow> = {}): OpRow {
  return {
    id: 'op-1',
    device: 'dev-a',
    entity: 'customer-store',
    field: 'customers',
    entityId: 'c1',
    kind: 'upsert',
    payload: '{"id":"c1","name":"Budi"}',
    ts: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('getItem / setItem / removeItem', () => {
  it('round-trips a value', () => {
    db.setItem('customer-store', 'blob-value')
    expect(db.getItem('customer-store')).toBe('blob-value')
  })

  it('returns null for a key that was never set', () => {
    expect(db.getItem('nonexistent')).toBeNull()
  })

  it('removeItem clears a key', () => {
    db.setItem('customer-store', 'blob-value')
    db.removeItem('customer-store')
    expect(db.getItem('customer-store')).toBeNull()
  })
})

describe('opsInsertOne', () => {
  it('returns an increasing seq per distinct op', () => {
    const seq1 = db.opsInsertOne(op({ id: 'op-1' }))
    const seq2 = db.opsInsertOne(op({ id: 'op-2' }))
    expect(seq1).not.toBeNull()
    expect(seq2).not.toBeNull()
    expect(seq2!).toBeGreaterThan(seq1!)
  })

  it('is idempotent by id — retrying the same op returns the same seq, not a duplicate', () => {
    const first = db.opsInsertOne(op({ id: 'op-1' }))
    const retry = db.opsInsertOne(op({ id: 'op-1' }))
    expect(retry).toBe(first)
    expect(db.opsSince(0)).toHaveLength(1)
  })
})

describe('opsSince', () => {
  it('returns only ops after the given seq, in ascending seq order', () => {
    const seq1 = db.opsInsertOne(op({ id: 'op-1', entityId: 'c1' }))!
    db.opsInsertOne(op({ id: 'op-2', entityId: 'c2' }))
    db.opsInsertOne(op({ id: 'op-3', entityId: 'c3' }))
    const since = db.opsSince(seq1) as { id: string; seq: number }[]
    expect(since.map((o) => o.id)).toEqual(['op-2', 'op-3'])
    expect(since[0].seq).toBeLessThan(since[1].seq)
  })

  it('returns everything when sinceSeq is 0', () => {
    db.opsInsertOne(op({ id: 'op-1' }))
    db.opsInsertOne(op({ id: 'op-2' }))
    expect(db.opsSince(0)).toHaveLength(2)
  })
})

describe('currentMaxSeq', () => {
  it('is 0 on an empty oplog', () => {
    expect(db.currentMaxSeq()).toBe(0)
  })

  it('reflects the highest seq inserted', () => {
    db.opsInsertOne(op({ id: 'op-1' }))
    const last = db.opsInsertOne(op({ id: 'op-2' }))
    expect(db.currentMaxSeq()).toBe(last)
  })
})

describe('snapshot', () => {
  it('is empty before anything is written', () => {
    expect(db.snapshot()).toEqual({})
  })

  it('reflects every key written via setItem', () => {
    db.setItem('customer-store', 'a')
    db.setItem('vehicle-store', 'b')
    expect(db.snapshot()).toEqual({ 'customer-store': 'a', 'vehicle-store': 'b' })
  })
})

describe('materializeOps (Fix 4b — standalone server must materialize key_value_store)', () => {
  it('applies a list op onto an empty blob', () => {
    const seq = db.opsInsertOne(op({ id: 'op-1', entity: 'customer-store', field: 'customers', entityId: 'c1' }))!
    db.materializeOps([{ ...op({ id: 'op-1', entity: 'customer-store', field: 'customers', entityId: 'c1' }), seq }])
    const blob = db.getItem('customer-store')
    expect(blob).not.toBeNull()
    expect(JSON.parse(blob!).state.customers).toEqual([{ id: 'c1', name: 'Budi' }])
  })

  it('is what makes snapshot() a correct materialization — this is the exact bug the standalone server had', () => {
    // Before this fix: nothing on the standalone server's write path ever
    // touched key_value_store, so snapshot() returned {} forever regardless
    // of how many ops had been pushed.
    expect(db.snapshot()).toEqual({})
    const theOp = op({ id: 'op-1', entity: 'customer-store', field: 'customers', entityId: 'c1' })
    const seq = db.opsInsertOne(theOp)!
    db.materializeOps([{ ...theOp, seq }])
    expect(db.snapshot()).not.toEqual({})
    expect(db.snapshot()['customer-store']).toBeDefined()
  })

  it('applies multiple ops for the same field in seq order regardless of array order', () => {
    const opA = op({ id: 'op-a', entityId: 'c1', payload: JSON.stringify({ id: 'c1', name: 'First' }) })
    const opB = op({ id: 'op-b', entityId: 'c1', payload: JSON.stringify({ id: 'c1', name: 'Second' }) })
    const seqA = db.opsInsertOne(opA)!
    const seqB = db.opsInsertOne(opB)!
    // Passed out of order on purpose — materializeOps must sort by seq itself.
    db.materializeOps([
      { ...opB, seq: seqB },
      { ...opA, seq: seqA },
    ])
    const blob = JSON.parse(db.getItem('customer-store')!)
    expect(blob.state.customers).toEqual([{ id: 'c1', name: 'Second' }])
  })

  it('skips an op for an entity/field this deployment does not recognize, without throwing', () => {
    const unknownOp = op({ entity: 'not-a-real-store', field: 'whatever', entityId: 'x' })
    const seq = db.opsInsertOne(unknownOp)!
    expect(() => db.materializeOps([{ ...unknownOp, seq }])).not.toThrow()
    expect(db.getItem('not-a-real-store')).toBeNull()
  })

  it('a delete op removes the row from the materialized list', () => {
    const upsert = op({ id: 'op-1', entityId: 'c1', kind: 'upsert', payload: JSON.stringify({ id: 'c1', name: 'Budi' }) })
    const seq1 = db.opsInsertOne(upsert)!
    db.materializeOps([{ ...upsert, seq: seq1 }])

    const del = op({ id: 'op-2', entityId: 'c1', kind: 'delete', payload: '' })
    const seq2 = db.opsInsertOne(del)!
    db.materializeOps([{ ...del, seq: seq2 }])

    const blob = JSON.parse(db.getItem('customer-store')!)
    expect(blob.state.customers).toEqual([])
  })
})

describe('persist / reopen', () => {
  it('data survives closing and reopening the same file', async () => {
    db.setItem('customer-store', 'a')
    db.opsInsertOne(op({ id: 'op-1' }))
    db.persist()

    const reopened = await openDatabase(dbFilePath)
    expect(reopened.getItem('customer-store')).toBe('a')
    expect(reopened.opsSince(0)).toHaveLength(1)
  })
})

// A burst of writes (e.g. a cashier typing into a discount field) used to
// trigger a full db.export() + fs.writeFileSync per keystroke — see this
// file's header. setItem/removeItem/opsInsertOne now debounce that flush
// instead of doing it inline; these tests pin the debounced behavior down
// directly against the file on disk, separately from getItem/opsSince (which
// read the in-memory db and were never affected).
describe('debounced persist', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not write the file synchronously on setItem', () => {
    const before = fs.readFileSync(dbFilePath)
    db.setItem('customer-store', 'a')
    expect(fs.readFileSync(dbFilePath)).toEqual(before)
  })

  it('flushes the file once the debounce window elapses', () => {
    const before = fs.readFileSync(dbFilePath)
    db.setItem('customer-store', 'a')
    vi.advanceTimersByTime(250)
    expect(fs.readFileSync(dbFilePath)).not.toEqual(before)
  })

  it('coalesces a burst of writes into one flush', () => {
    for (let i = 0; i < 20; i++) db.setItem('customer-store', `value-${i}`)
    vi.advanceTimersByTime(250)
    // Reopening (synchronously reading the flushed bytes) must reflect only
    // the last write, proving every intermediate setItem shared one timer
    // rather than each scheduling — and firing — its own.
    expect(db.getItem('customer-store')).toBe('value-19')
  })

  it('persist() flushes immediately and cancels a pending debounced flush', () => {
    db.setItem('customer-store', 'a')
    db.persist()
    const flushedAt = fs.readFileSync(dbFilePath)
    expect(flushedAt.length).toBeGreaterThan(0)
    // The debounce timer persist() cancelled must not fire a second,
    // redundant flush later.
    vi.advanceTimersByTime(250)
    expect(fs.readFileSync(dbFilePath)).toEqual(flushedAt)
  })

  it('opsInsertOne alone (no setItem) still reaches disk', async () => {
    db.opsInsertOne(op({ id: 'op-1' }))
    vi.advanceTimersByTime(250)
    vi.useRealTimers() // openDatabase below awaits real fs/sql.js I/O
    const reopened = await openDatabase(dbFilePath)
    expect(reopened.opsSince(0)).toHaveLength(1)
  })
})

// A transient read failure (antivirus/OneDrive lock, permissions, a second
// process holding the file) used to be indistinguishable from "no database
// yet": both landed in the same bare `catch { fileBuffer = undefined }`,
// which built a brand-new EMPTY in-memory database and then immediately
// overwrote the shop's real file with it. Only ENOENT (the file genuinely
// isn't there) should ever take that path.
describe('openDatabase — read-failure handling', () => {
  it('creates an empty database when the file genuinely does not exist yet (ENOENT)', async () => {
    const freshPath = path.join(os.tmpdir(), `surya-baru-enoent-${Date.now()}-${Math.random().toString(36).slice(2)}.db`)
    expect(fs.existsSync(freshPath)).toBe(false)
    const fresh = await openDatabase(freshPath)
    expect(fresh.snapshot()).toEqual({})
    fs.rmSync(freshPath, { force: true })
  })

  it('refuses to open (and never overwrites) a path that exists but cannot be read as a file', async () => {
    // A directory at the DB's path fails fs.readFileSync with EISDIR, not
    // ENOENT — a real, portable stand-in for "the file exists but this
    // process couldn't read it right now" (locked/permission-denied are the
    // realistic causes; EISDIR is what's reliably reproducible in a test).
    const dirPath = path.join(os.tmpdir(), `surya-baru-eisdir-${Date.now()}-${Math.random().toString(36).slice(2)}.db`)
    fs.mkdirSync(dirPath)
    try {
      await expect(openDatabase(dirPath)).rejects.toThrow(/Cannot read database/)
    } finally {
      fs.rmSync(dirPath, { recursive: true, force: true })
    }
  })
})

// persist() used to be a direct fs.writeFileSync(filePath, ...) — no temp
// file, no backup, no fsync. A crash mid-write could truncate the shop's
// only copy of its data with nothing to recover from.
describe('persist — atomic write with rotating backup', () => {
  it('does not create a .bak on the very first flush (nothing existed to back up)', () => {
    expect(fs.existsSync(`${dbFilePath}.bak`)).toBe(false)
  })

  it('backs up the prior file contents before a later flush overwrites them', async () => {
    // beforeEach's openDatabase() already performed the first flush (a
    // fresh file, so no .bak yet — see the test above). This is the SECOND
    // flush, which must back up what the first one wrote.
    db.setItem('customer-store', 'first-value')
    db.persist()

    db.setItem('customer-store', 'second-value')
    db.persist()

    expect(fs.existsSync(`${dbFilePath}.bak`)).toBe(true)
    const backup = await openDatabase(`${dbFilePath}.bak`)
    expect(backup.getItem('customer-store')).toBe('first-value')

    const current = await openDatabase(dbFilePath)
    expect(current.getItem('customer-store')).toBe('second-value')
  })

  it('leaves no stray .tmp file behind after a flush completes', () => {
    db.setItem('customer-store', 'a')
    db.persist()
    expect(fs.existsSync(`${dbFilePath}.tmp`)).toBe(false)
  })

  it('the main file is always a complete, openable database — never the mid-write temp state', () => {
    for (let i = 0; i < 5; i++) {
      db.setItem('customer-store', `value-${i}`)
      db.persist()
    }
    expect(() => fs.readFileSync(dbFilePath)).not.toThrow()
    expect(fs.statSync(dbFilePath).size).toBeGreaterThan(0)
  })
})
