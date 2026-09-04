import { FormEvent, useState } from 'react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { useAuthStore } from '../../store/authStore'
import { MIN_PASSWORD_LENGTH, validateNewPassword } from '../../lib/auth/password'
import { useTranslation } from '../../lib/i18n'

/** LockScreen's first-run "create the shop's admin password" step. Owns its
 *  own username/password/confirm/error/submitting state. */
export function AdminCreateForm({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation()
  const createAdminPassword = useAuthStore((s) => s.createAdminPassword)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (submitting) return
    const validationError = validateNewPassword({ username, password, confirmPassword })
    if (validationError === 'usernameRequired') {
      setError(t('auth.lockScreen.usernameRequired'))
      return
    }
    if (validationError === 'tooShort') {
      setError(t('auth.lockScreen.tooShort', { count: MIN_PASSWORD_LENGTH }))
      return
    }
    if (validationError === 'mismatch') {
      setError(t('auth.lockScreen.mismatch'))
      return
    }
    setSubmitting(true)
    setError(null)
    await createAdminPassword(username.trim(), password)
    setSubmitting(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-xs text-fg-3 mb-1">{t('auth.lockScreen.createHint')}</p>
      <Input label={t('auth.lockScreen.usernameLabel')} autoFocus value={username} onChange={(e) => setUsername(e.target.value)} />
      <Input label={t('auth.lockScreen.createLabel')} type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <Input
        label={t('auth.lockScreen.confirmLabel')}
        type="password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        error={error ?? undefined}
      />
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? t('auth.lockScreen.verifying') : t('auth.lockScreen.createButton')}
      </Button>
      <button type="button" onClick={onBack} className="w-full text-center text-xs text-fg-3 hover:text-fg-2 transition-colors py-1">
        {t('common.cancel')}
      </button>
    </form>
  )
}
