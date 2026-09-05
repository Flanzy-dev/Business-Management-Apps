import { FormEvent, useState } from 'react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { useAuthStore } from '../../store/authStore'
import { useThrottleCountdown } from '../../lib/auth/useThrottleCountdown'
import { useTranslation } from '../../lib/i18n'

/**
 * AdminElevateDialog's sign-in branch — username and password, verified
 * against the admin account only by authStore's signInAsAdmin (worker
 * credentials cannot elevate; see that function's doc). Mirrors
 * src/components/auth/SignInForm.tsx closely, including its ticking
 * throttle countdown — deliberately NOT throttleErrorMessage, which renders
 * a number once and freezes it, reading as a hung dialog through a 5-minute
 * lockout.
 *
 * The username field is never required client-side, unlike SignInForm's:
 * a legacy shop can have a real admin password with no adminUsername ever
 * recorded (see src/lib/auth/username.ts's adminUsernameMatches), and for
 * that shop the double-click is the ONLY door into Admin from a device
 * that isn't already there. Blocking submission on an empty username would
 * brick it. Leaving it blank on a shop that DOES have one just fails like
 * any other wrong guess — no extra plumbing needed to tell the two cases
 * apart here.
 *
 * Owns its own state — this renders inside a Dialog, and Dialog unmounts
 * its children on close (see Dialog.tsx: `if (!open) return null`), so
 * there is nothing to reset on success or on close; the next open starts
 * fresh automatically.
 */
export function AdminElevateForm() {
  const { t } = useTranslation()
  const signInAsAdmin = useAuthStore((s) => s.signInAsAdmin)
  const [username, setUsername] = useState('')
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
    const result = await signInAsAdmin(username, password)
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
        setError(t('auth.lockScreen.wrongCredentials'))
      }
    }
  }

  const lockedMessage = lockedSeconds > 0 ? t('auth.lockScreen.tooManyAttempts', { seconds: lockedSeconds }) : null

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Input
        label={t('auth.lockScreen.usernameSignInLabel')}
        name="username"
        autoComplete="username"
        autoFocus
        autoCapitalize="none"
        autoCorrect="off"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <Input
        label={t('auth.lockScreen.passwordLabel')}
        name="password"
        type="password"
        revealToggle
        autoComplete="current-password"
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
