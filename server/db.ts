// The SQLite database this app's data actually lives in — extracted from
// electron/main.ts so the exact same implementation can run two ways: owned
// by the Electron main process (the shop-PC LAN server) or standalone under
// plain Node (a Ubuntu box acting as the always-on host). See server/index.ts
// for the standalone entry point and electron/main.ts for the embedded one;
// neither should reimplement any of this, or the two could drift apart.
//
// sql.js (WASM SQLite) is used instead of a native module like
// better-sqlite3 so there is no node-gyp/native-rebuild step required across
// platforms — including here, where "platforms" now includes a Ubuntu box.
// Its API is synchronous, which is what lets the Electron renderer bridge
// stay a plain synchronous IPC call (see storageAdapter.ts) and every
// existing store keep working with zero changes. The whole database is kept
// in memory and flushed to disk on every write — fine for this app's write
// frequency (per user action, not per frame); see the note in the plan about
// revisiting this if the file ever grows enough to matter.
import * as fs from 'fs'
import * as path from 'path'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const initSqlJs = require('sql.js')

const KV_TABLE_SQL = 'CREATE TABLE IF NOT EXISTS key_value_store (key TEXT PRIMARY KEY, value TEXT NOT NULL)'
// The multi-device sync oplog: every change any device makes is one row here,
// in the single total order `seq` gives every device something to agree on.
// `id` is the client-generated idempotency key — a device retrying a push
// after a dropped connection must not double-apply. `entity` is the store's
// storage key; `field` is which of that store's persisted fields the op
// belongs to — most stores persist one array and don't need it, but e.g.
// expense-store persists both `expenses` and `categories`, and without
// `field` an op couldn't say which one it's for. See syncServer.ts and
// (renderer-side) src/lib/sync/ for how this gets consumed.
const OPS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS ops (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT UNIQUE NOT NULL,
  device TEXT NOT NULL,
  entity TEXT NOT NULL,
  field TEXT NOT NULL,
  entityId TEXT NOT NULL,
  kind TEXT NOT NULL,
  payload TEXT NOT NULL,
  ts TEXT NOT NULL
)`

export interface OpRow {
  id: string
  device: string
  entity: string
  field: string
  entityId: string
  kind: string
  payload: string
  ts: string
}

export interface SyncDatabase {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
  /** Append one op, or find its existing row if a device is retrying a push
   *  it already sent — same id, same seq, no duplicate. Returns the seq the
   *  caller can advance its cursor past. */
  opsInsertOne(op: OpRow): number | null
  /** Every op after a device's last-seen seq, in the order every device agrees on. */
  opsSince(sinceSeq: number): unknown[]
  /** The whole key_value_store as a plain object — what a device joining cold starts from. */
  snapshot(): Record<string, string>
  currentMaxSeq(): number
  persist(): void
}

/**
 * Opens (creating if needed) the SQLite file at `filePath` and returns the
 * synchronous read/write surface both the Electron LAN server and the
 * standalone Ubuntu server talk to identically.
 */
export async function openDatabase(filePath: string): Promise<SyncDatabase> {
  const SQL = await initSqlJs({
    locateFile: (file: string) => path.join(path.dirname(require.resolve('sql.js/dist/sql-wasm.js')), file),
  })

  fs.mkdirSync(path.dirname(filePath), { recursive: true })

  let fileBuffer: Buffer | undefined
  try {
    fileBuffer = fs.readFileSync(filePath)
  } catch {
    fileBuffer = undefined
  }
  const db: any = fileBuffer ? new SQL.Database(fileBuffer) : new SQL.Database()
  db.run(KV_TABLE_SQL)
  db.run(OPS_TABLE_SQL)

  function persist(): void {
    fs.writeFileSync(filePath, Buffer.from(db.export()))
  }
  persist()

  function getItem(key: string): string | null {
    const stmt = db.prepare('SELECT value FROM key_value_store WHERE key = :key')
    stmt.bind({ ':key': key })
    let result: string | null = null
    if (stmt.step()) {
      result = stmt.getAsObject().value as string
    }
    stmt.free()
    return result
  }

  function setItem(key: string, value: string): void {
    db.run(
      'INSERT INTO key_value_store (key, value) VALUES (:key, :value) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      { ':key': key, ':value': value }
    )
    persist()
  }

  function removeItem(key: string): void {
    db.run('DELETE FROM key_value_store WHERE key = :key', { ':key': key })
    persist()
  }

  function opsInsertOne(op: OpRow): number | null {
    db.run(
      'INSERT OR IGNORE INTO ops (id, device, entity, field, entityId, kind, payload, ts) VALUES (:id, :device, :entity, :field, :entityId, :kind, :payload, :ts)',
      { ':id': op.id, ':device': op.device, ':entity': op.entity, ':field': op.field, ':entityId': op.entityId, ':kind': op.kind, ':payload': op.payload, ':ts': op.ts }
    )
    const stmt = db.prepare('SELECT seq FROM ops WHERE id = :id')
    stmt.bind({ ':id': op.id })
    let seq: number | null = null
    if (stmt.step()) seq = stmt.getAsObject().seq as number
    stmt.free()
    return seq
  }

  function opsSince(sinceSeq: number): unknown[] {
    const stmt = db.prepare('SELECT seq, id, device, entity, field, entityId, kind, payload, ts FROM ops WHERE seq > :since ORDER BY seq ASC')
    stmt.bind({ ':since': sinceSeq })
    const rows: unknown[] = []
    while (stmt.step()) rows.push(stmt.getAsObject())
    stmt.free()
    return rows
  }

  function snapshot(): Record<string, string> {
    const stmt = db.prepare('SELECT key, value FROM key_value_store')
    const result: Record<string, string> = {}
    while (stmt.step()) {
      const row = stmt.getAsObject()
      result[row.key as string] = row.value as string
    }
    stmt.free()
    return result
  }

  function currentMaxSeq(): number {
    const stmt = db.prepare('SELECT COALESCE(MAX(seq), 0) as maxSeq FROM ops')
    let maxSeq = 0
    if (stmt.step()) maxSeq = stmt.getAsObject().maxSeq as number
    stmt.free()
    return maxSeq
  }

  return { getItem, setItem, removeItem, opsInsertOne, opsSince, snapshot, currentMaxSeq, persist }
}
