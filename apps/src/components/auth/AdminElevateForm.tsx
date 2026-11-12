import { FormEvent, useState } from 'react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { useAuthStore } from '../../store/authStore'
import { useSecurityStore } from '../../store/securityStore'
import { useThrottleCountdown } from '../../lib/auth/useThrottleCountdown'
import { useTranslation } from '../../lib/i18n'

/**
 * AdminElevateDialog's sign-in branch — password, verified against the admin
 * account only by authStore's signInAsAdmin (worker credentials cannot
 * elevate; see that function's doc). Mirrors src/components/auth/
 * SignInForm.tsx closely, including its ticking throttle countdown —
 * deliberately NOT throttleErrorMessage, which renders a number once and
 * freezes it, reading as a hung dialog through a 5-minute lockout.
 *
 * No username field at all: this form only ever renders at
 * AdminElevateDialog's step === 'signIn', which resolveAuthStep only returns
 * once an admin account already exists — so unlike SignInForm (which can
 * face zero, one, or two accounts) there is exactly one admin account to be
 * signing in as, always. The stored adminUsername (possibly null, on a
 * legacy shop that never set one — see src/lib/auth/username.ts's
 * adminUsernameMatches) is submitted automatically; signInAsAdmin's
 * throttle/failure accounting is unaffected either way, since there's no
 * longer a typed username that could be wrong.
 *
 * Owns its own state — this renders inside a Dialog, and Dialog unmounts
 * its children on close (see Dialog.tsx: `if (!open) return null`), so
 * there is nothing to reset on success or on close; the next open starts
 * fresh automatically.
 */
export function AdminElevateForm() {
  const { t } = useTranslation()
  // fallow-ignore-next-line code-duplication -- deliberate mirror of SignInForm.tsx, see this file's header
  const signInAsAdmin = useAuthStore((s) => s.signInAsAdmin)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [retryAt, setRetryAt] = useState<number | null>(null)
  const lockedSeconds = useThrottleCountdown(retryAt)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!password || submitting || lockedSeconds > 0) return
    setSubmitting(true)
    setError(null)
    // Re-read at submit time rather than trusting the render-time selector,
    // in case a rename synced in between — same reasoning as SignInForm's
    // resolveSubmitUsername.
    // fallow-ignore-next-line code-duplication -- deliberate mirror of SignInForm.tsx, see this file's header
    const result = await signInAsAdmin(useSecurityStore.getState().security.adminUsername ?? '', password)
    setSubmitting(false)
    // On success AdminElevateDialog's own effect (watching isAdmin) closes
    // this dialog and shows the toast — nothing to do here.
    if (!result.ok) {
      setPassword('')
      if (result.retryAfterMs > 0) {
        setRetryAt(Date.now() + result.retryAfterMs)
        setError(null)
      } else {
        setRetryAt(null)
        setError(t('auth.lockScreen.wrongPassword'))
      }
    }
  }

  const lockedMessage = lockedSeconds > 0 ? t('auth.lockScreen.tooManyAttempts', { seconds: lockedSeconds }) : null

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Input
        label={t('auth.lockScreen.passwordLabel')}
        name="password"
        type="password"
        revealToggle
        autoComplete="current-password"
        autoFocus
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={lockedMessage ?? error ?? undefined}
      />
      <Button type="submit" className="w-full" disabled={submitting || !password || lockedSeconds > 0}>
        {submitting ? t('auth.lockScreen.verifying') : t('auth.session.elevateConfirm')}
      </Button>
    </form>
  )
}
