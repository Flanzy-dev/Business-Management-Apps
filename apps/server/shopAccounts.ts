// Reads the shop's two login accounts out of the synced security-store row,
// the same way server/shopToken.ts reads the LAN token and
// server/shopName.ts reads the shop name — one narrow reader per thing the
// server needs out of the app's own data, rather than the server importing
// the app's zustand stores.
//
// The row is the zustand-persist envelope written by
// src/store/securityStore.ts:
//
//   {"state":{"security":{adminUsername, adminPasswordHash, ...}},"version":0}
//
// Getting that one nesting level wrong fails silently — the reader just
// never finds an account and every login is rejected — which is why
// server/__tests__/shopAccounts.test.ts asserts against a real envelope.
import type { SyncDatabase } from './db'

/** Which of the shop's two accounts a set of credentials matched. Mirrors
 *  src/lib/auth/permissions.ts's `Mode`, kept as its own literal union here
 *  so the server build doesn't import the app's permission module. */
export type AccountRole = 'admin' | 'worker'

export interface ShopAccount {
  role: AccountRole
  /** null for an admin account that has a real password but never had a
   *  username recorded — a legitimate, deliberately-supported legacy state
   *  (see src/store/securityStore.ts's adminUsername doc). Never null for
   *  worker: see readShopAccounts's worker branch for why. */
  username: string | null
  passwordHash: string
}

/**
 * Every account the shop has, in the order a login should try them.
 *
 * The two roles use DIFFERENT presence rules, on purpose:
 *  - admin: only the HASH has to be real. The same rule
 *    src/lib/auth/storedSession.ts's resolveStoredSession already applies
 *    ("the hash, not the username, is what proves an admin account
 *    exists") — a shop can have a genuine admin password with no
 *    adminUsername ever recorded, and src/lib/auth/username.ts's
 *    adminUsernameMatches (which server/syncServer.ts's handleLogin calls)
 *    already knows how to match that account leniently. This function used
 *    to require BOTH halves for every role, which silently excluded that
 *    account from the list entirely — no username to match against, ever,
 *    for ANY typed username, no matter how correct the password. That
 *    account could sign in on its own device (both src/store/authStore.ts's
 *    signIn and signInAsAdmin apply the same leniency) but could never pair
 *    a second one over the shop's WiFi, since /api/login never even
 *    considered it.
 *  - worker: both halves are required, unchanged. src/store/securityStore.ts's
 *    setWorkerAccount always writes username and passwordHash together as
 *    one atomic pair, so there is no legacy "unnamed worker" state to be
 *    lenient about — a worker entry missing either half is simply absent.
 *
 * A brand-new shop (no admin hash at all) returns an empty list, which is
 * correct: there is nothing to log in to yet.
 */
export function readShopAccounts(db: SyncDatabase): ShopAccount[] {
  try {
    const raw = db.getItem('security-store')
    if (!raw) return []
    const parsed = JSON.parse(raw)
    const security = parsed?.state?.security
    if (!security) return []

    const accounts: ShopAccount[] = []

    if (typeof security.adminPasswordHash === 'string' && security.adminPasswordHash) {
      const adminUsername =
        typeof security.adminUsername === 'string' && security.adminUsername.trim()
          ? security.adminUsername.trim()
          : null
      accounts.push({ role: 'admin', username: adminUsername, passwordHash: security.adminPasswordHash })
    }

    if (
      typeof security.workerUsername === 'string' &&
      security.workerUsername.trim() &&
      typeof security.workerPasswordHash === 'string' &&
      security.workerPasswordHash
    ) {
      accounts.push({ role: 'worker', username: security.workerUsername.trim(), passwordHash: security.workerPasswordHash })
    }

    return accounts
  } catch {
    return []
  }
}

/**
 * The shop's LAN token for the given role, regardless of whether it is
 * currently *required* — deliberately different from server/shopToken.ts's
 * readShopToken, which returns undefined unless `lanTokenRequired` is on
 * because its answer drives the auth gate.
 *
 * This one exists for the opposite reason: a device that has just proved it
 * knows an account password should leave /api/login holding whatever token
 * the shop has for that role, so that turning the requirement on *later*
 * never locks that device out. Handing it over only once it was already
 * mandatory would make the switch in Settings > Security a lockout for every
 * device paired before it was flipped — the precise failure
 * src/lib/sync/hostConfig.ts's resolveAuthToken() was written to avoid.
 *
 * Role-aware since src/store/securityStore.ts split the single `lanToken`
 * into an admin-tier `lanToken` and a worker-tier `workerLanToken` — see
 * that field's doc for why a worker-obtained token must be a DIFFERENT
 * secret from the admin one (server/syncServer.ts's validateOpBatch relies
 * on being able to tell the two apart for security-store writes).
 */
export function readLanTokenForHandover(db: SyncDatabase, role: AccountRole): string | null {
  try {
    const raw = db.getItem('security-store')
    if (!raw) return null
    const security = JSON.parse(raw)?.state?.security
    const token = role === 'admin' ? security?.lanToken : security?.workerLanToken
    return typeof token === 'string' && token.trim() ? token : null
  } catch {
    return null
  }
}
