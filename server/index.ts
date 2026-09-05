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
//   SHOP_TOKEN  shared password required on every /api/* call — an ops-level
//               override for this deployment; wins over whatever's saved in
//               the shop's own data (see shopToken.ts) when set. Default:
//               fall back to the shop's Settings > Security token, if any.
//   PORT        port to listen on (default 5174, matching the Electron LAN server)
import * as path from 'path'
import { openDatabase } from './db'
import { createSyncServer } from './syncServer'
import { readShopName } from './shopName'
import { readShopToken, readWorkerShopToken } from './shopToken'
import { readShopAccounts, readLanTokenForHandover } from './shopAccounts'
import { startDiscoveryResponder } from './discovery'
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
const envToken = process.env.SHOP_TOKEN || undefined

let db: Awaited<ReturnType<typeof openDatabase>>

async function main() {
  db = await openDatabase(dbFilePath)
  const { server } = createSyncServer({
    db,
    distDir,
    // A getter, not the resolved value: SHOP_TOKEN (an ops-level override)
    // wins when set, otherwise re-reads the shop's own Settings > Security
    // token on every request — see shopToken.ts's lanTokenRequired check —
    // so toggling that switch takes effect immediately, no restart needed.
    token: () => envToken || readShopToken(db),
    // Same override precedence as `token` above: SHOP_TOKEN, when set, is
    // this deployment's one operator-controlled secret, so a caller
    // presenting it is treated as admin-tier throughout (presentedTokenRole
    // checks the admin `token` getter first — see syncServer.ts) regardless
    // of which shop account it happens to also match. Without SHOP_TOKEN,
    // this is the shop's own generated worker-tier secret, distinct from the
    // admin one — see server/shopToken.ts's readWorkerShopToken.
    workerToken: () => envToken || readWorkerShopToken(db),
    getShopName: () => readShopName(db),
    allowedEntities: ALLOWED_ENTITIES,
    isSyncableKey: isShopDataKey,
    // Getters for the same reason `token` is one — a shop's accounts arrive
    // by normal security-store sync, potentially long after this process
    // started, so anything snapshotted here would never see them.
    getAccounts: () => readShopAccounts(db),
    // Must mirror `token` above, env override included. Handing back the
    // shop's own lanToken while the gate actually demands SHOP_TOKEN would
    // let a device log in successfully, save the wrong token, and then 401
    // on every request afterwards — a pairing that reports success and is
    // broken, the worst of both.
    getLanToken: (role) => envToken || readLanTokenForHandover(db, role),
  })

  // Answers UDP probes so a device on this network can find this host
  // without anyone typing its IP — see server/discovery.ts. Best-effort:
  // a failed bind is logged and ignored, because the manual address field
  // in Settings still works exactly as it did before.
  const discovery = startDiscoveryResponder({
    getShopName: () => readShopName(db),
    syncPort: PORT,
    onError: (err) => console.error('Discovery responder unavailable:', err.message),
  })

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Surya Baru sync server listening on http://0.0.0.0:${PORT}`)
    console.log(`  database: ${dbFilePath}`)
    console.log(`  serving app from: ${distDir}`)
    console.log(
      `  auth: ${envToken ? 'shop token required (SHOP_TOKEN env override)' : 'following the shop\'s Settings > Security token, if any'}`
    )
  })

  const shutdown = () => {
    // Writes now debounce (see db.ts's schedulePersist) instead of flushing
    // on every call — force the last pending write out before exiting, or a
    // shutdown landing inside that window would lose it.
    db.persist()
    discovery.close()
    server.close(() => process.exit(0))
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((err) => {
  console.error('Failed to start sync server:', err)
  process.exit(1)
})
