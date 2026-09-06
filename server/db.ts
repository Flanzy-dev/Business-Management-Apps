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
// Shared with the renderer via tsconfig.server.json's widened include list —
// see that file's header. Store-free, Node-safe: applyOpsToBlob is a pure
// function and SYNC_FIELDS is plain data, so pulling them into a Node-only
// process doesn't drag in React/zustand.
import { applyOpsToBlob } from '../src/lib/sync/merge'
import { SYNC_FIELDS, STORE_VERSIONS } from '../src/lib/sync/syncFields'
import { SYNC_OP_KINDS } from '../src/lib/sync/types'
import type { SyncKind, SyncOp, SyncOpWithSeq } from '../src/lib/sync/types'

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
export const OPS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS ops (
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

/**
 * An op as it travels over the wire and sits in the `ops` table. This is the
 * renderer's SyncOp — the same type, not a copy of it: the two used to be
 * declared separately and field-for-field, with this half weakening `kind`
 * from SyncOpKind to plain `string`, and nothing anywhere compared them.
 * Kept as a named alias because `OpRow` is what the server-side code and its
 * tests call it, and because it reads as the table's row shape here.
 */
export type OpRow = SyncOp

// Set<string>, not Set<SyncOpKind> — this is checked against a value off the
// wire that is only known to be a string at that point (see isOpRow). The
// *contents* still come from the one source in types.ts.
const OP_KIND_VALUES = new Set<string>(SYNC_OP_KINDS)

/**
 * Runtime shape check for a value claiming to be an OpRow — the server has
 * no compiler to lean on for whatever a client's HTTP body actually
 * contains. Used by syncServer.ts's /api/ops POST handler, which previously
 * did nothing but `ops.map((op: OpRow) => ...)`, a type assertion with zero
 * runtime effect: a malformed or malicious body would have been persisted
 * as-is. Domain-agnostic on purpose — this only checks the wire shape, not
 * whether `entity`/`field` are values this deployment actually recognizes;
 * see SyncServerOptions.allowedEntities in syncServer.ts for that.
 */
export function isOpRow(value: unknown): value is OpRow {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === 'string' &&
    typeof v.device === 'string' &&
    typeof v.entity === 'string' &&
    typeof v.field === 'string' &&
    typeof v.entityId === 'string' &&
    typeof v.kind === 'string' &&
    OP_KIND_VALUES.has(v.kind) &&
    typeof v.payload === 'string' &&
    typeof v.ts === 'string'
  )
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
  /**
   * Applies an already-inserted batch of ops onto key_value_store, using the
   * same applyOpsToBlob merge every client uses. Without this, the only
   * thing that ever wrote key_value_store was the Electron renderer's own
   * IPC bridge (see electron/main.ts's db:setItem handler) — so a standalone
   * deployment (server/index.ts), which no renderer ever talks to directly,
   * had a permanently empty key_value_store: snapshot() always returned
   * `{}`, and a device cold-joining it ended up blank while its cursor still
   * jumped to the host's seq, skipping the very history it needed. This
   * keeps snapshot() a correct materialization of the oplog on every
   * deployment, embedded or standalone. See syncServer.ts's /api/ops POST
   * handler for the caller.
   */
  materializeOps(ops: (OpRow & { seq: number })[]): void
  persist(): void
  /** Message from the most recent failed debounced flush, or null if the last
   *  one succeeded. electron/main.ts forwards it to the renderer so the user
   *  is warned a change may not have reached disk. */
  getLastPersistError(): string | null
}

/**
 * Opens (creating if needed) the SQLite file at `filePath` and returns the
 * synchronous read/write surface both the Electron LAN server and the
 * standalone Ubuntu server talk to identically.
 */
export async function openDatabase(
  filePath: string,
  onPersistError?: (message: string) => void,
): Promise<SyncDatabase> {
  const SQL = await initSqlJs({
    locateFile: (file: string) => path.join(path.dirname(require.resolve('sql.js/dist/sql-wasm.js')), file),
  })

  fs.mkdirSync(path.dirname(filePath), { recursive: true })

  let fileBuffer: Buffer | undefined
  let fileExisted = true
  try {
    fileBuffer = fs.readFileSync(filePath)
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code !== 'ENOENT') {
      // Anything other than "the file genuinely doesn't exist yet" (a lock
      // held by an antivirus scanner, OneDrive/cloud-sync, a permissions
      // problem, a second instance of this app already holding it open) must
      // never be treated as "no database yet" — doing so used to silently
      // build a brand-new EMPTY in-memory database and then, a few lines
      // below, overwrite the shop's real file with it. Surface the failure
      // instead so the caller (electron/main.ts) can show a recovery dialog
      // rather than the shop's data vanishing with no error at all.
      throw new Error(
        `Cannot read database at ${filePath} (${code ?? err}): refusing to create a new database over what may be a locked or damaged existing file.`
      )
    }
    fileBuffer = undefined
    fileExisted = false
  }
  const db: any = fileBuffer ? new SQL.Database(fileBuffer) : new SQL.Database()
  db.run(KV_TABLE_SQL)
  db.run(OPS_TABLE_SQL)

  // Flushing on every write was fine at this app's original write frequency
  // (per user action) but not once callers can fire many writes per second —
  // e.g. a cashier typing into the Diskon (Rp) field, where each keystroke
  // used to trigger a full `db.export()` + fs.writeFileSync of the *entire*
  // database, synchronously, on the caller's thread. persist() below is now
  // an on-demand *forced* flush (still used for before-quit/shutdown, and
  // still fully synchronous when called); ordinary writes instead debounce
  // through schedulePersist() so a burst of keystrokes coalesces into one
  // flush ~250ms after things go quiet. Reads never see stale data — they
  // all come from the in-memory sql.js `db`, which every write updates
  // immediately; only the on-disk file lags, by at most PERSIST_DEBOUNCE_MS.
  const PERSIST_DEBOUNCE_MS = 250
  const PERSIST_RETRY_MS = 5_000
  let persistTimer: ReturnType<typeof setTimeout> | null = null
  let persistRetryTimer: ReturnType<typeof setTimeout> | null = null
  // The message from the most recent failed debounced flush (null = the last
  // one was fine). A flush that throws — disk full, an AV/OneDrive lock on the
  // .tmp or the rename — used to become an uncaught exception straight out of
  // the timer below: invisible, unretried, coalesced writes lost. It's now
  // caught in schedulePersist(), recorded here for the renderer to surface,
  // and retried once since such a lock is often transient.
  let lastPersistError: string | null = null

  function persist(): void {
    if (persistTimer) {
      clearTimeout(persistTimer)
      persistTimer = null
    }
    const tmpPath = `${filePath}.tmp`
    const bakPath = `${filePath}.bak`
    // Keep one generation of backup: if a real file is already on disk, copy
    // it aside before this write replaces it, so a bad flush (or a bug in
    // whatever produced this in-memory state) still leaves a recoverable
    // prior copy — see electron/main.ts's corrupt-database recovery dialog,
    // which offers to restore from exactly this file. A failed backup must
    // never block the real write: losing one backup generation is far
    // better than losing the write itself.
    try {
      if (fs.existsSync(filePath)) fs.copyFileSync(filePath, bakPath)
    } catch {
      // Best-effort only — see comment above.
    }
    // Write-to-temp + fsync + rename instead of a direct writeFileSync: a
    // crash or power loss mid-write can only ever leave the OLD complete
    // file at `filePath` (the rename hasn't happened yet) or the NEW
    // complete file (it has) — never a half-written one. rename() is atomic
    // on both NTFS and ext4, which is every platform this app ships on.
    const data = Buffer.from(db.export())
    const fd = fs.openSync(tmpPath, 'w')
    try {
      fs.writeSync(fd, data)
      fs.fsyncSync(fd)
    } finally {
      fs.closeSync(fd)
    }
    fs.renameSync(tmpPath, filePath)
  }

  function schedulePersist(): void {
    if (persistTimer) return
    persistTimer = setTimeout(() => {
      persistTimer = null
      try {
        persist()
        lastPersistError = null
      } catch (err) {
        lastPersistError = err instanceof Error ? err.message : String(err)
        onPersistError?.(lastPersistError)
        // One retry, and only one pending at a time — a permanently full disk
        // shouldn't spin. Any later setItem/removeItem re-arms the debounce
        // and gets another attempt anyway.
        if (!persistRetryTimer) {
          persistRetryTimer = setTimeout(() => {
            persistRetryTimer = null
            schedulePersist()
          }, PERSIST_RETRY_MS)
          persistRetryTimer.unref?.()
        }
      }
    }, PERSIST_DEBOUNCE_MS)
    // Never keeps the standalone Node server (server/index.ts) process alive
    // just because a flush is pending.
    persistTimer.unref?.()
  }

  // Only a genuinely new database needs an immediate flush to put the file
  // (and its now-`CREATE TABLE IF NOT EXISTS`'d schema) on disk — an
  // existing file that loaded fine doesn't need rewriting just because the
  // app started, and rewriting it unconditionally is exactly the behavior
  // that used to turn a transient read failure above into data loss.
  if (!fileExisted) persist()

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
    schedulePersist()
  }

  function removeItem(key: string): void {
    db.run('DELETE FROM key_value_store WHERE key = :key', { ':key': key })
    schedulePersist()
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
    // Was previously undurable on its own — an inserted op only ever reached
    // disk if some later setItem happened to flush behind it. Same debounce
    // as setItem/removeItem, not a synchronous persist(), so a push of many
    // ops doesn't reintroduce the per-write flush cost this file exists to
    // avoid.
    schedulePersist()
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

  /** SYNC_FIELDS is keyed by the app's StoreKey literal union; an op's
   *  `entity`/`field` are plain strings off the wire, so this looks them up
   *  defensively rather than indexing directly. */
  function findSyncKind(entity: string, field: string): SyncKind | null {
    const specs = (SYNC_FIELDS as Record<string, readonly { kind: SyncKind; itemsField: string }[]>)[entity]
    return specs?.find((s) => s.itemsField === field)?.kind ?? null
  }

  /** See STORE_VERSIONS's doc comment (src/lib/sync/syncFields.ts) — this is
   *  the server-side half of the same lookup engine.ts's applyRemoteOps does
   *  client-side, so a fresh envelope materialized here (a store this
   *  deployment's key_value_store has never seen before) is stamped with the
   *  store's real version instead of 0. */
  function findStoreVersion(entity: string): number {
    return (STORE_VERSIONS as Record<string, number>)[entity] ?? 0
  }

  function materializeOps(ops: (OpRow & { seq: number })[]): void {
    // Group by entity+field (mirrors src/lib/sync/engine.ts's applyRemoteOps
    // on the client) so each field's blob is read once and written once,
    // with its ops applied together in seq order — applyOpsToBlob expects
    // its input pre-sorted, it doesn't sort internally.
    const byEntityField = new Map<string, (OpRow & { seq: number })[]>()
    for (const op of [...ops].sort((a, b) => a.seq - b.seq)) {
      const key = `${op.entity} ${op.field}`
      const list = byEntityField.get(key) ?? []
      list.push(op)
      byEntityField.set(key, list)
    }

    for (const [key, opsForField] of byEntityField) {
      const [entity, field] = key.split(' ')
      const kind = findSyncKind(entity, field)
      // An entity/field this deployment's SYNC_FIELDS doesn't recognize
      // (a stale client, or allowedEntities wasn't configured and something
      // unexpected slipped through) still lives in the oplog for replay to
      // other clients — there's just no safe default `kind` to materialize
      // it into key_value_store with, so it's skipped here only.
      if (!kind) continue

      // `OpRow & { seq: number }` is structurally SyncOpWithSeq, so this used
      // to be a field-by-field copy that existed only to launder `kind`
      // through an `as SyncOpKind` cast. Now that OpRow *is* SyncOp, the rows
      // are already the right type and the cast is gone with the copy.
      const syncOps: SyncOpWithSeq[] = opsForField
      setItem(entity, applyOpsToBlob(kind, field, getItem(entity), syncOps, findStoreVersion(entity)))
    }
  }

  return { getItem, setItem, removeItem, opsInsertOne, opsSince, snapshot, currentMaxSeq, materializeOps, persist, getLastPersistError: () => lastPersistError }
}
