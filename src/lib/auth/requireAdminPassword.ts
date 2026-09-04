// Re-asks the admin password for a danger-zone action, even while already
// signed in as admin — Settings.tsx's Clear All Data, Restore Backup,
// change sync host, and become-main all gate through this.
import { usePasswordPromptStore } from '../../store/passwordPromptStore'
import { useSecurityStore } from '../../store/securityStore'
import { translate } from '../i18n'

/**
 * Resolves true only once the admin password has been correctly
 * re-entered. Resolves true immediately when no admin password has ever
 * been set (nothing to verify against yet — first-run state, matches how
 * signInAdmin/LockScreen treat that case). Resolves false if the dialog is
 * dismissed. `reason` is shown under the dialog title, explaining why.
 */
export function requireAdminPassword(reason: string): Promise<boolean> {
  if (!useSecurityStore.getState().security.adminPasswordHash) return Promise.resolve(true)
  return usePasswordPromptStore.getState().request({ title: translate('auth.reauth.title'), message: reason })
}
