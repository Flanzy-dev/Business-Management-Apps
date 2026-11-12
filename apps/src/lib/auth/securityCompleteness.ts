// The shop's security record is "complete" when every account has the
// credentials that go with it:
//
// - an admin account   → an admin-tier LAN token (`lanToken`) and a recovery code
// - a worker account   → its own worker-tier LAN token (`workerLanToken`)
//
// Why each matters:
// - Without `lanToken`, server/shopToken.ts's readShopToken treats the shop as
//   "nothing to demand" and leaves the LAN sync server open to anyone on the
//   WiFi despite there being a password to protect.
// - `workerLanToken` is deliberately a SEPARATE credential:
//   server/syncServer.ts's validateOpBatch refuses a security-store write
//   unless the presented token is the admin one, which is what stops a
//   worker-paired device from rewriting the admin password over the LAN. A
//   worker device still needs some token to sync ordinary data.
// - Without a recovery code, one forgotten admin password locks the shop out
//   for good.
//
// This invariant used to be enforced in four places — authStore's
// createAdminPassword plus three separate App.tsx backfills
// (ensureLanToken / ensureWorkerLanToken / ensureAdminRecoveryCode). It's one
// rule, so it's one module: `missingSecurityFields` states it,
// `ensureSecurityComplete` restores it. Runs on every device: security-store
// is a synced singleton, so whichever device gets there first is enough, and
// a redundant write from a second device settles via last-write-wins.
import { useSecurityStore } from '../../store/securityStore'
import { useRecoveryCodeStore } from '../../store/uiStores'
import { generateShopToken } from './shopToken'
import { hashPassword } from './password'
import { generateRecoveryCode, normalizeRecoveryCode } from './recoveryCode'

export type SecurityField = 'lanToken' | 'workerLanToken' | 'adminRecoveryCode'

interface SecurityCredentials {
  adminPasswordHash: string | null
  lanToken: string | null
  adminRecoveryCodeHash: string | null
  workerPasswordHash: string | null
  workerLanToken: string | null
}

/** What this record is missing. Pure — the whole invariant, in one place. */
export function missingSecurityFields(s: SecurityCredentials): SecurityField[] {
  const missing: SecurityField[] = []
  if (s.adminPasswordHash && !s.lanToken) missing.push('lanToken')
  if (s.workerPasswordHash && !s.workerLanToken) missing.push('workerLanToken')
  if (s.adminPasswordHash && !s.adminRecoveryCodeHash) missing.push('adminRecoveryCode')
  return missing
}

/**
 * Fill whatever `missingSecurityFields` reports.
 *
 * Tokens are minted silently. The recovery code is different: minting one
 * means DISPLAYING it, so it only happens on a live admin session on this
 * device — a Worker tablet that noticed the gap first would otherwise hand
 * Admin's code to whoever is holding it. `isAdminSession` is passed in (a
 * getter, re-read after the async hash) rather than imported, so authStore
 * can call this without an import cycle.
 *
 * Fire-and-forget: the recovery-code branch is async internally (hashing),
 * but nothing needs to await it — the dialog appearing a moment after paint
 * is no different from any other backfill becoming visible a tick late.
 */
export function ensureSecurityComplete(opts: { isAdminSession: () => boolean }): void {
  const store = useSecurityStore.getState()
  const missing = missingSecurityFields(store.security)

  if (missing.includes('lanToken')) store.setLanToken(generateShopToken())
  if (missing.includes('workerLanToken')) store.setWorkerLanToken(generateShopToken())

  if (!missing.includes('adminRecoveryCode') || !opts.isAdminSession()) return
  void (async () => {
    const code = generateRecoveryCode()
    const hash = await hashPassword(normalizeRecoveryCode(code))

    // Re-check after the await: another device could have raced this same
    // backfill (security-store is synced) and already won, or this device
    // could have signed out mid-hash. Either way, minting a second code now
    // would overwrite one already in someone's hands, or show Admin's code
    // to a session that is no longer Admin.
    if (useSecurityStore.getState().security.adminRecoveryCodeHash || !opts.isAdminSession()) return
    useSecurityStore.getState().setAdminRecoveryCodeHash(hash)
    useRecoveryCodeStore.getState().show(code)
  })()
}
