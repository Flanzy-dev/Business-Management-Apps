// Re-asks the admin password for a danger-zone action, even while already
// signed in as admin — Settings.tsx's Clear All Data, Restore Backup,
// change sync host, and become-main all gate through this.
import { usePasswordPromptStore } from '../../store/passwordPromptStore'
import { useSecurityStore } from '../../store/securityStore'
import { translate } from '../i18n'

/**
 * Resolves true only once the admin password has been correctly
 * re-entered. Resolves false if the dialog is dismissed. `reason` is shown
 * under the dialog title, explaining why.
 *
 * Resolves true immediately, with nothing verified, when
 * `adminPasswordHash` is currently falsy. That carve-out used to matter for
 * first-run — a shop with no account yet had no way to reach any of these
 * nine callers in the first place, since every one sits behind
 * <RequireAdmin> and the only pre-account door into Admin was
 * enterAdminWithoutPassword. That door is deleted now (see
 * src/store/authStore.ts's signInAsAdmin and
 * src/components/auth/AdminElevateDialog.tsx), so at the MOMENT of
 * elevation an admin hash always exists.
 *
 * What keeps this carve-out from being provably dead, and why it stays: the
 * hash can still vanish DURING a live admin session. security-store is a
 * synced singleton (see src/store/securityStore.ts's header) whose own
 * documented failure mode is a stale offline device's push blanking the
 * whole object — accepted there as "fails OPEN... the safe direction for a
 * small shop on a trusted LAN". RestoreRecoveryFlow can also replace every
 * store's contents wholesale mid-session. In that narrow window, all nine
 * callers below are `if (!(await requireAdminPassword(...))) return` —
 * refusing here would make all nine Settings buttons silently do nothing:
 * no dialog, no error, no toast, nothing to diagnose from a bug report.
 * Failing open instead means an already-authenticated admin session skips a
 * confirmation it could not possibly satisfy (there is no password to type
 * against), which matches securityStore's own stated posture. See
 * src/components/settings/WorkerAccountSection.tsx's handleOpenForm for a
 * caller that deliberately relies on this rather than adding its own guard.
 */
export function requireAdminPassword(reason: string): Promise<boolean> {
  if (!useSecurityStore.getState().security.adminPasswordHash) return Promise.resolve(true)
  return usePasswordPromptStore.getState().request({ title: translate('auth.reauth.title'), message: reason })
}
