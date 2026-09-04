import { FormEvent, useState } from 'react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { useAuthStore } from '../../store/authStore'
import { throttleErrorMessage } from '../../lib/auth/loginThrottle'
import { useTranslation } from '../../lib/i18n'

/** LockScreen's "sign in as the existing admin" step. Owns its own
 *  password/error/submitting state — the parent only needs to know when to
 *  go back to the chooser. */
export function AdminSignInForm({ adminUsername, onBack }: { adminUsername: string | null; onBack: () => void }) {
  const { t } = useTranslation()
  const signInAdmin = useAuthStore((s) => s.signInAdmin)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!password || submitting) return
    setSubmitting(true)
    setError(null)
    const result = await signInAdmin(password)
    setSubmitting(false)
    if (!result.ok) {
      setPassword('')
      setError(throttleErrorMessage(result.retryAfterMs, t, 'auth.lockScreen.wrongPassword'))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {adminUsername && (
        <p className="text-sm text-fg-2 text-center mb-1">{t('auth.lockScreen.signingInAs', { username: adminUsername })}</p>
      )}
      <Input
        label={t('auth.lockScreen.passwordLabel')}
        type="password"
        autoFocus
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={error ?? undefined}
      />
      <Button type="submit" className="w-full" disabled={submitting || !password}>
        {submitting ? t('auth.lockScreen.verifying') : t('auth.lockScreen.signInButton')}
      </Button>
      <button type="button" onClick={onBack} className="w-full text-center text-xs text-fg-3 hover:text-fg-2 transition-colors py-1">
        {t('common.cancel')}
      </button>
    </form>
  )
}
