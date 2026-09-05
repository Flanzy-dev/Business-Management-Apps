import { FormEvent, useState } from 'react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { useAuthStore } from '../../store/authStore'
import { useThrottleCountdown } from '../../lib/auth/useThrottleCountdown'
import { useTranslation } from '../../lib/i18n'

/**
 * LoginScreen's sign-in step — username and password, matched against either
 * of the shop's two accounts by authStore's signIn. Which account you hold
 * decides the mode you land in; there is no separate "admin" form.
 *
 * Owns its own state: ToastHost lives in Layout, which is not mounted behind
 * the login screen, so errors are shown inline (see LoginScreen's header).
 */
export function SignInForm() {
  const { t } = useTranslation()
  const signIn = useAuthStore((s) => s.signIn)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // An epoch deadline rather than a pre-rendered string, so the countdown
  // below actually ticks instead of freezing at whatever it said first.
  const [retryAt, setRetryAt] = useState<number | null>(null)
  const lockedSeconds = useThrottleCountdown(retryAt)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password || submitting || lockedSeconds > 0) return
    setSubmitting(true)
    setError(null)
    const result = await signIn(username, password)
    setSubmitting(false)
    // On success this unmounts with the login screen, so there is nothing to
    // reset here.
    if (!result.ok) {
      setPassword('')
      if (result.retryAfterMs > 0) {
        setRetryAt(Date.now() + result.retryAfterMs)
        setError(null)
      } else {
        setRetryAt(null)
        // One message for a wrong name and a wrong password alike — the shop
        // is small enough that "which half was wrong?" helps a guesser more
        // than the person who mistyped.
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
      <Button
        type="submit"
        className="w-full"
        disabled={submitting || !username.trim() || !password || lockedSeconds > 0}
      >
        {submitting ? t('auth.lockScreen.verifying') : t('auth.lockScreen.signInButton')}
      </Button>
    </form>
  )
}
