import { FormEvent, useState } from 'react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { useAuthStore } from '../../store/authStore'
import { useSecurityStore } from '../../store/securityStore'
import { signInFieldShape } from '../../lib/auth/accountShape'
import { useThrottleCountdown } from '../../lib/auth/useThrottleCountdown'
import { useTranslation } from '../../lib/i18n'

/**
 * LoginScreen's sign-in step — username and password, matched against either
 * of the shop's two accounts by authStore's signIn. Which account you hold
 * decides the mode you land in; there is no separate "admin" form.
 *
 * The username field is hidden whenever the shop has exactly one account
 * (src/lib/auth/accountShape.ts's signInFieldShape) — with only one account
 * there's nothing for it to disambiguate, and on a legacy shop whose
 * adminUsername was never set it's worse than useless. signIn itself is
 * unchanged either way: this form just supplies the one account's own stored
 * username, so the matching, throttle accounting and marker write it does
 * are byte-identical to a person having typed that name correctly.
 *
 * Owns its own state: ToastHost lives in Layout, which is not mounted behind
 * the login screen, so errors are shown inline (see LoginScreen's header).
 */
export function SignInForm() {
  const { t } = useTranslation()
  const signIn = useAuthStore((s) => s.signIn)

  // Four primitive selectors, not one object selector — this screen
  // shouldn't re-render on unrelated lanToken/lanTokenRequired sync traffic,
  // same reasoning as LoginScreen's own adminPasswordHash selector.
  const adminUsername = useSecurityStore((s) => s.security.adminUsername)
  const adminPasswordHash = useSecurityStore((s) => s.security.adminPasswordHash)
  const workerUsername = useSecurityStore((s) => s.security.workerUsername)
  const workerPasswordHash = useSecurityStore((s) => s.security.workerPasswordHash)
  // Derived on every render, never seeded into useState — same rule as
  // resolveAuthStep. A cold follower can be hydrated with the admin hash
  // present and the worker account not yet synced down; the shape must be
  // free to flip from passwordOnly to askUsername the instant that lands,
  // not pin itself on the wrong one.
  const shape = signInFieldShape({ adminUsername, adminPasswordHash, workerUsername, workerPasswordHash })
  const showUsername = shape.kind === 'askUsername'

  // fallow-ignore-next-line code-duplication -- deliberate mirror of AdminElevateForm.tsx, see that file's header
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // An epoch deadline rather than a pre-rendered string, so the countdown
  // below actually ticks instead of freezing at whatever it said first.
  const [retryAt, setRetryAt] = useState<number | null>(null)
  const lockedSeconds = useThrottleCountdown(retryAt)

  // Whichever username actually gets submitted — what was typed if the field
  // is shown, or the shop's one account's own name if it's hidden. Re-read
  // from the store at submit time (not the shape captured at render) so a
  // sync landing mid-typing can't submit a stale name; worst case if it still
  // races is an ordinary wrong-credentials rejection, costing exactly one
  // throttle unit like any other mistake.
  const resolveSubmitUsername = (): string => {
    if (showUsername) return username
    const security = useSecurityStore.getState().security
    const freshShape = signInFieldShape({
      adminUsername: security.adminUsername,
      adminPasswordHash: security.adminPasswordHash,
      workerUsername: security.workerUsername,
      workerPasswordHash: security.workerPasswordHash,
    })
    // If a sync landed between render and submit and there are now two (or
    // zero) accounts, there's no single username left to supply — fall back
    // to '' rather than the stale one captured at render. signIn rejects it
    // as an ordinary wrong-credentials attempt, same as any mistyped guess.
    return freshShape.kind === 'passwordOnly' ? freshShape.username : ''
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const canSubmit = showUsername ? !!username.trim() && !!password : !!password
    if (!canSubmit || submitting || lockedSeconds > 0) return
    setSubmitting(true)
    setError(null)
    // fallow-ignore-next-line code-duplication -- deliberate mirror of AdminElevateForm.tsx, see that file's header
    const result = await signIn(resolveSubmitUsername(), password)
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
        // One message for a wrong name and a wrong password alike when both
        // are being asked for — the shop is small enough that "which half
        // was wrong?" helps a guesser more than the person who mistyped.
        // When there's no username field to have gotten wrong, say so.
        setError(t(showUsername ? 'auth.lockScreen.wrongCredentials' : 'auth.lockScreen.wrongPassword'))
      }
    }
  }

  const lockedMessage = lockedSeconds > 0 ? t('auth.lockScreen.tooManyAttempts', { seconds: lockedSeconds }) : null

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {showUsername && (
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
      )}
      <Input
        label={t('auth.lockScreen.passwordLabel')}
        name="password"
        type="password"
        revealToggle
        autoComplete="current-password"
        autoFocus={!showUsername}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={lockedMessage ?? error ?? undefined}
      />
      <Button
        type="submit"
        className="w-full"
        disabled={submitting || !password || (showUsername && !username.trim()) || lockedSeconds > 0}
      >
        {submitting ? t('auth.lockScreen.verifying') : t('auth.lockScreen.signInButton')}
      </Button>
    </form>
  )
}
