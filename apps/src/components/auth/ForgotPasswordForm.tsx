import { FormEvent, useState } from 'react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { useAuthStore } from '../../store/authStore'
import { useSecurityStore } from '../../store/securityStore'
import { verifyAgainstHash, throttleErrorMessage } from '../../lib/auth/loginThrottle'
import { normalizeRecoveryCode } from '../../lib/auth/recoveryCode'
import { newPasswordFieldErrors, MIN_PASSWORD_LENGTH } from '../../lib/auth/password'
import { useTranslation } from '../../lib/i18n'

type Phase = 'code' | 'newPassword'

/**
 * LoginScreen's "Forgot password?" step — resets the shop's ADMIN password
 * using the recovery code minted alongside the account
 * (src/lib/auth/recoveryCode.ts, src/store/authStore.ts's
 * createAdminPassword). Two phases, mirroring RestoreRecoveryFlow's shape
 * (owns its whole phase state so the parent only mounts/unmounts this
 * component, resetting it fresh each time):
 *
 *  1. Prove the code — verified locally against
 *     security.adminRecoveryCodeHash with the same verifyAgainstHash helper
 *     RestoreRecoveryFlow uses for its own backup-embedded-password check,
 *     so a wrong guess here costs exactly what a wrong guess costs anywhere
 *     else in this app.
 *  2. Choose a new password — the actual write happens in
 *     authStore.resetAdminPasswordWithRecoveryCode, which re-verifies the
 *     code itself rather than trusting phase 1's result; that keeps the
 *     one function that persists a new password hash and an admin marker
 *     as the single place a valid code is ever the thing that decided to do
 *     it.
 */
export function ForgotPasswordForm({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation()
  const adminRecoveryCodeHash = useSecurityStore((s) => s.security.adminRecoveryCodeHash)
  const adminUsername = useSecurityStore((s) => s.security.adminUsername)
  const resetAdminPasswordWithRecoveryCode = useAuthStore((s) => s.resetAdminPasswordWithRecoveryCode)

  const [phase, setPhase] = useState<Phase>('code')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleVerifyCode = async (e: FormEvent) => {
    e.preventDefault()
    if (!code || submitting || !adminRecoveryCodeHash) return
    setSubmitting(true)
    setError(null)
    const result = await verifyAgainstHash(normalizeRecoveryCode(code), adminRecoveryCodeHash)
    setSubmitting(false)
    if (!result.ok) {
      setError(throttleErrorMessage(result.retryAfterMs, t, 'auth.lockScreen.forgotWrongCode'))
      return
    }
    setPhase('newPassword')
  }

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault()
    if (submitting) return

    // adminUsername is passed through so an empty admin name (a legacy shop
    // that never set one — securityStore.ts's own documented state) can
    // never trip usernameRequired here; this step isn't naming an account,
    // it's changing a password.
    const errors = newPasswordFieldErrors({ username: adminUsername ?? 'admin', password, confirmPassword })
    if (errors.password) {
      setError(t('auth.lockScreen.tooShort', { count: MIN_PASSWORD_LENGTH }))
      return
    }
    if (errors.confirmPassword) {
      setError(t('auth.lockScreen.mismatch'))
      return
    }

    setSubmitting(true)
    setError(null)
    // Re-verifies the code itself — see this component's header. A stale or
    // now-superseded code (someone else regenerated it from Settings while
    // this device sat on this screen) is caught HERE, not assumed from
    // phase 1's earlier success.
    const result = await resetAdminPasswordWithRecoveryCode(code, password)
    setSubmitting(false)
    if (!result.ok) {
      setPassword('')
      setConfirmPassword('')
      setError(throttleErrorMessage(result.retryAfterMs, t, 'auth.lockScreen.forgotWrongCode'))
      setPhase('code')
      return
    }
    // On success this unmounts with the login screen (mode flips to
    // 'admin') — nothing left to reset here.
  }

  return (
    <div className="space-y-3">
      {phase === 'code' && (
        <form onSubmit={handleVerifyCode} className="space-y-3">
          <p className="text-xs text-fg-3 mb-1">{t('auth.lockScreen.forgotHint')}</p>
          <Input
            label={t('auth.lockScreen.forgotCodeLabel')}
            name="recovery-code"
            mono
            autoFocus
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="off"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            error={error ?? undefined}
          />
          <Button type="submit" className="w-full" disabled={submitting || !code}>
            {submitting ? t('auth.lockScreen.verifying') : t('auth.lockScreen.forgotContinueButton')}
          </Button>
        </form>
      )}

      {phase === 'newPassword' && (
        <form onSubmit={handleResetPassword} className="space-y-3">
          <p className="text-xs text-fg-3 mb-1">{t('auth.lockScreen.forgotNewPasswordHint')}</p>
          <Input label={t('auth.lockScreen.forgotAccountLabel')} value={adminUsername ?? ''} readOnly disabled />
          <Input
            label={t('auth.lockScreen.createLabel')}
            name="new-password"
            type="password"
            revealToggle
            autoFocus
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            hint={t('auth.lockScreen.passwordHint', { count: MIN_PASSWORD_LENGTH })}
          />
          <Input
            label={t('auth.lockScreen.confirmLabel')}
            name="confirm-password"
            type="password"
            revealToggle
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={error ?? undefined}
          />
          <Button type="submit" className="w-full" disabled={submitting || !password || !confirmPassword}>
            {submitting ? t('auth.lockScreen.verifying') : t('auth.lockScreen.forgotResetButton')}
          </Button>
        </form>
      )}

      <button
        type="button"
        onClick={onBack}
        className="w-full text-center text-xs text-fg-3 hover:text-fg-2 transition-colors py-1 focus-ring rounded-radius-xs"
      >
        {t('auth.lockScreen.backToSignInLabel')}
      </button>
    </div>
  )
}
