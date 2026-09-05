// Hosts the app-wide admin re-auth dialog requested via
// src/lib/auth/requireAdminPassword() / usePasswordPromptStore.request() —
// mirrors Layout.tsx's local ConfirmHost, mounted once next to it. Unlike
// ConfirmDialog, this one actually re-verifies the password before
// resolving true; a wrong entry shows an error and stays open rather than
// resolving.
//
// Password-only, and that's deliberate: every caller of requireAdminPassword
// sits behind <RequireAdmin>, so a session already exists here — this is
// re-CONFIRMING an action inside it, not identifying who's asking. The
// double-click Worker → Admin elevate gesture used to also route through
// this same dialog (which is why it once asked for a password only, with no
// username field); it now has its own dedicated
// src/components/auth/AdminElevateDialog.tsx instead, which DOES ask for
// both — see src/store/authStore.ts's signInAsAdmin for why that had to be
// a separate function from the one this component calls.
import { FormEvent, useState } from 'react'
import { Dialog, DialogFooter } from '../ui/Dialog'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { usePasswordPromptStore } from '../../store/passwordPromptStore'
import { useAuthStore } from '../../store/authStore'
import { throttleErrorMessage } from '../../lib/auth/loginThrottle'
import { useTranslation } from '../../lib/i18n'

export function PasswordPromptHost() {
  const { t } = useTranslation()
  const pending = usePasswordPromptStore((s) => s.pending)
  const close = usePasswordPromptStore((s) => s.close)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const reset = () => {
    setPassword('')
    setError(null)
    setSubmitting(false)
  }

  const handleClose = () => {
    reset()
    close(false)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!password || submitting) return
    setSubmitting(true)
    setError(null)
    // Routed through the same throttled path used everywhere else a
    // password is checked (src/store/authStore.ts's confirmAdminPassword),
    // not a direct verifyPassword call — this dialog re-verifies the exact
    // same admin password, so it has to share the same brute-force cooldown
    // or a re-auth prompt would have been an unthrottled second way to guess
    // it. Unlike the elevate dialog's signInAsAdmin, this does NOT touch the
    // session marker or `mode` — every caller here is already admin.
    const result = await useAuthStore.getState().confirmAdminPassword(password)
    if (result.ok) {
      reset()
      close(true)
    } else {
      setSubmitting(false)
      setPassword('')
      setError(throttleErrorMessage(result.retryAfterMs, t, 'auth.reauth.wrongPassword'))
    }
  }

  return (
    <Dialog open={!!pending} onClose={handleClose} title={pending?.title} size="sm">
      <form onSubmit={handleSubmit}>
        <div className="space-y-3">
          {pending?.message && <p className="text-sm text-fg-2">{pending.message}</p>}
          <Input
            label={t('auth.reauth.passwordLabel')}
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={error ?? undefined}
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={handleClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={submitting || !password}>
            {submitting ? t('auth.lockScreen.verifying') : pending?.confirmLabel ?? t('auth.reauth.confirmButton')}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
