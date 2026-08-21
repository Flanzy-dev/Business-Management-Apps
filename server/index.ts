// Standalone entry point: run the sync server as a plain Node process, no
// Electron involved — this is what a Ubuntu box (or any always-on machine)
// runs so the shop's data has a host that never gets switched off at night.
// Same server/db.ts + server/syncServer.ts the Electron LAN server embeds,
// so behavior can't drift between "my shop PC is the host" and "my Ubuntu
// server is the host" — see docs/ubuntu-server.md for deployment.
//
// Env vars (all optional, sensible defaults for trying it locally):
//   SURYA_DB    path to the SQLite file (default ./surya-baru.db)
//   SURYA_DIST  path to the built app's dist/ to serve (default ../dist next to this file)
//   SHOP_TOKEN  shared password required on every /api/* call (default: none — open)
//   PORT        port to listen on (default 5174, matching the Electron LAN server)
import * as path from 'path'
import { openDatabase } from './db'
import { createSyncServer } from './syncServer'
import { PERSISTED_STORES, isShopDataKey } from '../src/lib/storageKeys'

const ALLOWED_ENTITIES = PERSISTED_STORES.map((s) => s.storageKey)

const PORT = parseInt(process.env.PORT || '5174', 10)
// Compiled to dist-server/server/index.js (tsconfig.server.json's rootDir is
// "." so it can also share src/lib/storageKeys.ts + src/lib/sync/{merge,
// syncFields,types}.ts with the standalone build — see that file's header).
// __dirname here is dist-server/server, one level deeper than it used to be
// when this compiled straight to dist-server/index.js — both defaults below
// account for that so they still land in the same places as before.
const dbFilePath = process.env.SURYA_DB || path.join(__dirname, '..', 'surya-baru.db')
const distDir = process.env.SURYA_DIST || path.join(__dirname, '../../dist')
const token = process.env.SHOP_TOKEN || undefined

function getShopName(): string {
  try {
    const raw = db.getItem('settings-store')
    if (!raw) return '—'
    const parsed = JSON.parse(raw)
    return parsed?.state?.shopName ?? '—'
  } catch {
    return '—'
  }
}

let db: Awaited<ReturnType<typeof openDatabase>>

async function main() {
  db = await openDatabase(dbFilePath)
  const { server } = createSyncServer({
    db,
    distDir,
    token,
    getShopName,
    allowedEntities: ALLOWED_ENTITIES,
    isSyncableKey: isShopDataKey,
  })

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Surya Baru sync server listening on http://0.0.0.0:${PORT}`)
    console.log(`  database: ${dbFilePath}`)
    console.log(`  serving app from: ${distDir}`)
    console.log(`  auth: ${token ? 'shop token required' : 'none (open on this network)'}`)
  })

  const shutdown = () => {
    // Writes now debounce (see db.ts's schedulePersist) instead of flushing
    // on every call — force the last pending write out before exiting, or a
    // shutdown landing inside that window would lose it.
    db.persist()
    server.close(() => process.exit(0))
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((err) => {
  console.error('Failed to start sync server:', err)
  process.exit(1)
})
