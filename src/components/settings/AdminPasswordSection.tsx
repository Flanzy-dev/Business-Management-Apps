import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { useSecurityStore } from '../../store/securityStore'
import { useToastStore } from '../../store/toastStore'
import { requireAdminPassword } from '../../lib/auth/requireAdminPassword'
import { hashPassword, MIN_PASSWORD_LENGTH, validateNewPassword } from '../../lib/auth/password'
import { getDeviceId } from '../../lib/deviceId'
import { useTranslation } from '../../lib/i18n'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'

/**
 * The admin-password half of SecurityCard: status line + Set/Change button,
 * or the create-new-password form. Split out on its own since the form's
 * five fields of local state and its validate-then-save handler were most of
 * SecurityCard's complexity — the LAN token half is a separate, unrelated
 * concern that never needs any of this state.
 */
export function AdminPasswordSection() {
  const { t } = useTranslation()
  const { security, setAdminPasswordHash, setAdminUsername, setAdminDeviceId } = useSecurityStore()
  const showToast = useToastStore((s) => s.show)

  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [usernameInput, setUsernameInput] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)

  const handleOpenPasswordForm = async () => {
    // Changing an existing password re-asks it first; setting the very
    // first one (nothing to verify against yet) skips straight to the form
    // — same "nothing to verify" carve-out as requireAdminPassword itself.
    if (security.adminPasswordHash) {
      if (!(await requireAdminPassword(t('auth.reauth.reasonChangePassword')))) return
    }
    setUsernameInput(security.adminUsername ?? '')
    setNewPassword('')
    setConfirmNewPassword('')
    setPasswordError(null)
    setShowPasswordForm(true)
  }

  const handleSavePassword = async () => {
    const validationError = validateNewPassword({
      username: usernameInput,
      password: newPassword,
      confirmPassword: confirmNewPassword,
    })
    if (validationError === 'usernameRequired') {
      setPasswordError(t('auth.lockScreen.usernameRequired'))
      return
    }
    if (validationError === 'tooShort') {
      setPasswordError(t('auth.lockScreen.tooShort', { count: MIN_PASSWORD_LENGTH }))
      return
    }
    if (validationError === 'mismatch') {
      setPasswordError(t('auth.lockScreen.mismatch'))
      return
    }
    setAdminPasswordHash(await hashPassword(newPassword))
    setAdminUsername(usernameInput.trim())
    // Claimed only if unbound (e.g. this is the first password this shop has
    // ever had, or an existing shop upgrading from before adminDeviceId
    // existed) — never unconditionally, so a routine password change from
    // the already-bound device can't re-point anything. See
    // src/store/securityStore.ts's adminDeviceId doc comment.
    if (!security.adminDeviceId) setAdminDeviceId(getDeviceId())
    setShowPasswordForm(false)
    showToast({ tone: 'success', title: t('auth.security.passwordChangedToast') })
  }

  return (
    <div>
      <label className="block text-2xs uppercase font-semibold tracking-wide text-fg-3 mb-1.5">
        {t('auth.security.adminPasswordLabel')}
      </label>
      {!showPasswordForm ? (
        <div className="flex items-center gap-3">
          <span className="text-sm text-text-secondary">
            {security.adminPasswordHash
              ? security.adminUsername
                ? t('auth.security.passwordSetStatusWithUsername', { username: security.adminUsername })
                : t('auth.security.passwordSetStatus')
              : t('auth.security.passwordNotSetStatus')}
          </span>
          <Button variant="secondary" size="sm" icon={KeyRound} onClick={handleOpenPasswordForm}>
            {security.adminPasswordHash ? t('auth.security.changePasswordButton') : t('auth.security.setPasswordButton')}
          </Button>
        </div>
      ) : (
        <div className="max-w-sm space-y-3">
          <Input
            label={t('auth.lockScreen.usernameLabel')}
            autoFocus
            value={usernameInput}
            onChange={(e) => setUsernameInput(e.target.value)}
          />
          <Input
            label={t('auth.lockScreen.createLabel')}
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <Input
            label={t('auth.lockScreen.confirmLabel')}
            type="password"
            value={confirmNewPassword}
            onChange={(e) => setConfirmNewPassword(e.target.value)}
            error={passwordError ?? undefined}
          />
          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={handleSavePassword}>
              {t('settings.saveButton')}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowPasswordForm(false)}>
              {t('common.cancel')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
