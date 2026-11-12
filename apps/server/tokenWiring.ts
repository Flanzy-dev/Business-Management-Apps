// How the standalone server (server/index.ts) turns "an optional SHOP_TOKEN
// env var + whatever the shop's own security-store holds" into the three
// things createSyncServer needs: the admin-tier token, the worker-tier token,
// and the token /api/login hands back. Pulled out of index.ts, which is a
// script with no tests, because the one rule here is a security boundary:
//
//   SHOP_TOKEN is the operator's ADMIN-tier secret, and nothing else.
//
// It used to be both tiers' token, and /api/login handed it to whichever role
// signed in — so a worker account came away holding the credential that
// unredacts the admin hashes and may rewrite the admin password.
import type { SyncDatabase } from './db'
import { readShopToken, readWorkerShopToken } from './shopToken'
import { readLanTokenForHandover, type AccountRole } from './shopAccounts'

export interface TokenWiring {
  /** Admin tier: SHOP_TOKEN when set, otherwise the shop's own LAN token. */
  token: () => string | undefined
  /** Worker tier: always the shop's own worker token, env override or not. */
  workerToken: () => string | undefined
  /** What a successful /api/login hands the device. Mirrors the getter for the
   *  SAME role, or a pairing reports success and then 401s on every request. */
  getLanToken: (role: AccountRole) => string | null
}

/** All three are getters, not resolved values: a shop's accounts and tokens
 *  arrive by normal security-store sync, potentially long after this process
 *  started, and toggling Settings > Security takes effect with no restart. */
export function buildTokenWiring(db: SyncDatabase, envToken: string | undefined): TokenWiring {
  return {
    token: () => envToken || readShopToken(db),
    workerToken: () => readWorkerShopToken(db),
    getLanToken: (role) => (role === 'admin' ? envToken || readLanTokenForHandover(db, 'admin') : readLanTokenForHandover(db, 'worker')),
  }
}
