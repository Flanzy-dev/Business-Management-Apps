import { useAuthStore, useIsAdmin } from '../store/authStore'
import { useSecurityStore } from '../store/securityStore'
import { useToastStore } from '../store/toastStore'
import { usePasswordPromptStore } from '../store/passwordPromptStore'
import { getDeviceId } from '../lib/deviceId'
import { useTranslation } from '../lib/i18n'

/**
 * Worker ⇄ Admin mode switch — Layout's profile-footer double-click.
 * Worker -> Admin asks for the admin password only when one is set; Admin ->
 * Worker is instant, no prompt. Pulled out of Layout.tsx as its own hook
 * since it's a real decision tree (four branches, each ending the switch a
 * different way) rather than rendering logic.
 */
export function useModeSwitch(): () => void {
  const { t } = useTranslation()
  const isAdmin = useIsAdmin()
  const dropToWorker = useAuthStore((s) => s.dropToWorker)

  return () => {
    if (isAdmin) {
      dropToWorker()
      useToastStore.getState().show({ tone: 'neutral', title: t('auth.session.droppedToWorkerToast') })
      return
    }

    const { adminPasswordHash, adminDeviceId } = useSecurityStore.getState().security

    // Admin is bound to another device - the lock screen hides the option
    // entirely in this state, so explain rather than show a prompt that can
    // never succeed.
    if (adminDeviceId && adminDeviceId !== getDeviceId()) {
      useToastStore.getState().show({ tone: 'danger', title: t('auth.lockScreen.adminNotHereNote') })
      return
    }

    // First-run shop, no password to verify against - elevate straight away.
    if (!adminPasswordHash) {
      if (useAuthStore.getState().enterAdminWithoutPassword()) {
        useToastStore.getState().show({ tone: 'success', title: t('auth.session.elevatedToast') })
      }
      return
    }

    // Password set: PasswordPromptHost (mounted in Layout) re-verifies it
    // through the same throttled signInAdmin path the lock screen uses and
    // flips mode to 'admin' on success.
    void usePasswordPromptStore
      .getState()
      .request({
        title: t('auth.session.elevateTitle'),
        message: t('auth.session.elevateMessage'),
        confirmLabel: t('auth.session.elevateConfirm'),
      })
      .then((ok) => {
        if (ok) useToastStore.getState().show({ tone: 'success', title: t('auth.session.elevatedToast') })
      })
  }
}
