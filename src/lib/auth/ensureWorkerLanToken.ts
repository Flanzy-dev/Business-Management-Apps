// Backfill: guarantees a shop with a worker account always has its own
// worker-tier LAN token, mirroring src/lib/auth/ensureLanToken.ts exactly —
// same one-shot-per-launch shape, same idempotent no-op-once-set behavior,
// called from the same App.tsx mount effect.
//
// Why a SEPARATE token from the admin one (src/store/securityStore.ts's
// `lanToken`): server/syncServer.ts's validateOpBatch refuses a
// `security-store` write unless the presented token is specifically the
// admin-tier one — see that file's header for the vulnerability this closes
// (a worker-obtained credential used to be indistinguishable from an
// admin-obtained one at the token-gate level, letting a worker password
// rewrite the shop's admin account over the LAN). A worker-paired device
// still needs SOME token to keep syncing ordinary shop data — that's the
// whole reason the worker account exists — so it gets this one instead.
//
// This runs on every device, not just a host: security-store is a synced
// singleton, so whichever device gets there first is enough, and a
// redundant write from a second device just settles via last-write-wins
// like any other concurrent set() on this store — identical reasoning to
// ensureLanToken.ts's own comment on that point.
import { useSecurityStore } from '../../store/securityStore'
import { generateShopToken } from './shopToken'

export function ensureWorkerLanToken(): void {
  const { workerPasswordHash, workerLanToken } = useSecurityStore.getState().security
  if (workerPasswordHash && !workerLanToken) {
    useSecurityStore.getState().setWorkerLanToken(generateShopToken())
  }
}
