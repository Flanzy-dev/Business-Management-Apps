import { useAuthStore, useIsAdmin } from '../store/authStore'
import { useToastStore } from '../store/toastStore'
import { useElevateDialogStore } from '../store/elevateDialogStore'
import { useTranslation } from '../lib/i18n'

/**
 * Worker ⇄ Admin mode switch — Layout's profile-footer double-click.
 * Admin -> Worker is instant, no prompt. Worker -> Admin opens
 * src/components/auth/AdminElevateDialog.tsx, which asks for the admin
 * account's username and password (or, on a shop with no admin account yet,
 * offers to create one) — there is no longer a way to reach Admin from here
 * with nothing verified.
 *
 * The hash/no-hash decision that used to live in THIS hook (a third branch,
 * "no password set yet, elevate straight away") has moved entirely into the
 * dialog. That's deliberate, not just a refactor: this hook reads
 * useSecurityStore.getState() once, at click time, and a cold follower's
 * security-store is briefly empty on every launch — deciding "no account"
 * here and acting on it immediately is exactly the race that lets someone
 * create a SECOND admin account a moment before the real one syncs in. The
 * dialog re-derives its step on every render instead (see
 * src/lib/auth/elevateStep.ts), so it can't get stuck on a snapshot this
 * hook took once and never revisited.
 */
export function useModeSwitch(): () => void {
  const { t } = useTranslation()
  const isAdmin = useIsAdmin()
  const enterWorkerMode = useAuthStore((s) => s.enterWorkerMode)

  return () => {
    if (isAdmin) {
      enterWorkerMode()
      useToastStore.getState().show({ tone: 'neutral', title: t('auth.session.droppedToWorkerToast') })
      return
    }

    useElevateDialogStore.getState().setOpen(true)
  }
}
