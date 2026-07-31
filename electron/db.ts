// The SQLite database this app's data actually lives in. Owned by the Electron
// main process (see electron/main.ts, which wires it to the db:* IPC handlers)
// and reached from the renderer only through src/lib/storageAdapter.ts — no
// store or page touches storage directly.
//
// sql.js (WASM SQLite) is used instead of a native module like better-sqlite3
// so there is no node-gyp/native-rebuild step required across platforms. Its
// API is synchronous, which is what lets the renderer bridge stay a plain
// synchronous IPC call (see storageAdapter.ts) and every store keep working
// with zero changes. The whole database is kept in memory and flushed to disk
// on every write — fine for this app's write frequency (per user action, not
// per frame).
import * as fs from 'fs'
import * as path from 'path'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const initSqlJs = require('sql.js')

const KV_TABLE_SQL = 'CREATE TABLE IF NOT EXISTS key_value_store (key TEXT PRIMARY KEY, value TEXT NOT NULL)'

export interface Database {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
  persist(): void
}

/**
 * Opens (creating if needed) the SQLite file at `filePath` and returns the
 * synchronous read/write surface the main process serves to the renderer.
 */
export async function openDatabase(filePath: string): Promise<Database> {
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

  return { getItem, setItem, removeItem, persist }
}
