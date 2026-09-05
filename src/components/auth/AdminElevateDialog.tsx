// The double-click Worker → Admin gesture's dialog — a dedicated component
// rather than an extension of PasswordPromptHost.
//
// Why separate: PasswordPromptHost is the sole UI for nine danger-zone
// re-auth confirmations (Clear All Data, Restore Backup, change sync host,
// become-main, change admin password, two worker-account paths, two
// LAN-token paths), and this project's Vitest runs environment: 'node' with
// no DOM — a regression in that component is catchable only by a human
// clicking nine buttons in Settings. Adding a "does this need a username
// too?" branch to it would make its fields, its validation, its submit
// target and its error key all conditional, for zero benefit to those nine
// callers. Re-auth is a confirmation inside an already-open admin session;
// elevate is an identification, plus (see below) an entire third
// create-account branch. Splitting them is the same call LoginScreen
// already made by not being one component with a `step` prop — see its
// header.
//
// It also shrinks src/store/passwordPromptStore.ts's existing flaw instead
// of feeding it: a second request() while one is pending silently orphans
// the first promise (no queue, no guard). Before this file existed, the
// elevate gesture was the ONE caller of that store that wasn't
// requireAdminPassword, i.e. the one reachable from a different screen in a
// different mode — exactly how that bug could have become a real one.
// Leaving it out keeps every remaining caller an `await` inside a single
// event handler on an admin-only route, where a concurrent second
// request() is practically unreachable. Fixing that store is a genuine,
// separate follow-up.
import { useEffect, useState } from 'react'
import { Dialog } from '../ui/Dialog'
import { useElevateDialogStore } from '../../store/elevateDialogStore'
import { useIsAdmin } from '../../store/authStore'
import { useSecurityStore } from '../../store/securityStore'
import { useToastStore } from '../../store/toastStore'
import { resolveAuthStep, type AuthStep } from '../../lib/auth/elevateStep'
import { useTranslation } from '../../lib/i18n'
import { AdminElevateForm } from './AdminElevateForm'
import { AdminCreateForm } from './AdminCreateForm'

export function AdminElevateDialog() {
  const { t } = useTranslation()
  const open = useElevateDialogStore((s) => s.open)
  const setOpen = useElevateDialogStore((s) => s.setOpen)
  const isAdmin = useIsAdmin()

  // A primitive selector, not the whole `security` object — same reason as
  // LoginScreen.tsx: this dialog shouldn't re-render on unrelated
  // lanToken/lanTokenRequired sync traffic.
  const adminPasswordHash = useSecurityStore((s) => s.security.adminPasswordHash)

  // Derived, never seeded — see resolveAuthStep's header. This is the
  // sharpest bug this whole dialog could have: a cold follower opening it
  // in the "no account" window would offer to CREATE the admin account, and
  // whoever double-clicked would make a second one that collides with the
  // shop's real account the instant sync lands. The decision has to be
  // recomputed on every render, with `override` as the only memory, exactly
  // like LoginScreen.
  const [override, setOverride] = useState<AuthStep | null>(null)
  const step = resolveAuthStep(adminPasswordHash, override)
  const pinToCreate = () => setOverride((current) => current ?? 'create')

  const handleClose = () => {
    setOpen(false)
    // Reset for the next open — Dialog unmounts AdminElevateForm/
    // AdminCreateForm on close (Dialog.tsx: `if (!open) return null`), which
    // already clears their own local state, but the step override lives
    // here, one level up, so it needs its own reset.
    setOverride(null)
  }

  // One effect closes the dialog for BOTH branches: signInAsAdmin (the
  // sign-in form) and createAdminPassword (the create form, via
  // AdminCreateForm) each independently set mode to 'admin' on success —
  // see src/store/authStore.ts for both. There is no promise to resolve and
  // no per-branch success handler needed; whichever one got there, this
  // notices and reacts once.
  useEffect(() => {
    if (open && isAdmin) {
      setOpen(false)
      setOverride(null)
      useToastStore.getState().show({ tone: 'success', title: t('auth.session.elevatedToast') })
    }
  }, [open, isAdmin, setOpen, t])

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={t(step === 'create' ? 'auth.session.elevateCreateTitle' : 'auth.session.elevateTitle')}
      size="sm"
    >
      <div className="space-y-3">
        <p className="text-sm text-fg-2">
          {t(step === 'create' ? 'auth.session.elevateCreateMessage' : 'auth.session.elevateMessage')}
        </p>
        {step === 'signIn' && <AdminElevateForm />}
        {step === 'create' && <AdminCreateForm onDirty={pinToCreate} />}
      </div>
    </Dialog>
  )
}
