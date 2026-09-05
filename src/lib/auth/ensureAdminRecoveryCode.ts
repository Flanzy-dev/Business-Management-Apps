// Backfill: guarantees an admin account that predates recovery codes gets
// one, the same shape as src/lib/auth/ensureLanToken.ts (see that file's
// header — this exists for the identical reason, applied to the OTHER thing
// createAdminPassword now mints for every brand-new account).
//
// The one rule this file exists to enforce, and the reason it isn't simply
// "adminPasswordHash && !adminRecoveryCodeHash" like ensureLanToken.ts's
// check: minting a recovery code means DISPLAYING it
// (src/store/recoveryCodeStore.ts -> RecoveryCodeDialog), and that plaintext
// grants Admin to whoever is standing at whichever screen shows it. Run this
// unconditionally on every device — the way ensureLanToken.ts safely does,
// because a LAN token is not by itself a way into Admin — and a Worker
// tablet that happens to be the first device to notice a missing code would
// mint the shop's recovery code and hand Admin to whoever is standing in
// front of it. So this checks the LIVE session's own mode, not just the
// shop's stored accounts, and is a no-op on anything but an active admin
// session on THIS device.
import { useAuthStore } from '../../store/authStore'
import { useSecurityStore } from '../../store/securityStore'
import { useRecoveryCodeStore } from '../../store/recoveryCodeStore'
import { hashPassword } from './password'
import { generateRecoveryCode, normalizeRecoveryCode } from './recoveryCode'

/** Fire-and-forget: called from App.tsx's mount effect alongside the other
 *  one-time backfills. Async internally (hashing), but nothing needs to
 *  await it — the recovery-code dialog appearing a moment after the app
 *  paints is no different from any other backfill's effect becoming visible
 *  a tick late. */
export function ensureAdminRecoveryCode(): void {
  const { adminPasswordHash, adminRecoveryCodeHash } = useSecurityStore.getState().security
  if (!adminPasswordHash || adminRecoveryCodeHash) return
  if (useAuthStore.getState().mode !== 'admin') return

  void (async () => {
    const code = generateRecoveryCode()
    const hash = await hashPassword(normalizeRecoveryCode(code))

    // Re-check after the await: another device could have raced this same
    // backfill (security-store is a synced singleton) and already won, or
    // this device could have signed out mid-hash. Either way, minting a
    // second code now would either overwrite one already in someone's hands
    // or show Admin's recovery code to a session that is no longer Admin.
    const stillMissing = !useSecurityStore.getState().security.adminRecoveryCodeHash
    const stillAdmin = useAuthStore.getState().mode === 'admin'
    if (!stillMissing || !stillAdmin) return

    useSecurityStore.getState().setAdminRecoveryCodeHash(hash)
    useRecoveryCodeStore.getState().show(code)
  })()
}
