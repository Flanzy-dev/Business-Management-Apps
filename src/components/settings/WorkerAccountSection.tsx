import { useState } from 'react'
import { HardHat } from 'lucide-react'
import { useSecurityStore } from '../../store/securityStore'
import { useToastStore } from '../../store/toastStore'
import { useConfirmStore } from '../../store/confirmStore'
import { requireAdminPassword } from '../../lib/auth/requireAdminPassword'
import { hashPassword, MIN_PASSWORD_LENGTH, validateNewPassword } from '../../lib/auth/password'
import { usernameTakenBy } from '../../lib/auth/username'
import { useTranslation } from '../../lib/i18n'
import { Button } from '../ui/Button'
import { CredentialFields } from '../auth/CredentialFields'

/**
 * The worker-account half of SecurityCard, mirroring AdminPasswordSection's
 * shape: a status line with a Set/Change button, or the create form.
 *
 * What this account is NOT: a login the shop floor has to pass every
 * morning. Worker mode is still one tap with no password (authStore's
 * enterWorkerMode), deliberately — a technician blocked by a forgotten
 * password can't take a work order. This credential exists for the case one
 * tap cannot cover: proving to ANOTHER device that you belong to this shop,
 * at server/syncServer.ts's POST /api/login, so a new tablet can be paired
 * by someone who was never given the admin password.
 *
 * Optional throughout. A shop that never makes one simply pairs its devices
 * with the admin account instead, and server/shopAccounts.ts skips the
 * worker entry entirely when either half is unset.
 */
export function WorkerAccountSection() {
  const { t } = useTranslation()
  const { security, setWorkerAccount } = useSecurityStore()
  const showToast = useToastStore((s) => s.show)
  const requestConfirm = useConfirmStore((s) => s.request)

  const [showForm, setShowForm] = useState(false)
  const [usernameInput, setUsernameInput] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const isSet = !!security.workerPasswordHash

  const handleOpenForm = async () => {
    // Always re-auths, unlike AdminPasswordSection's first-password
    // carve-out: creating a worker account is never the first credential a
    // shop sets (there is an admin account by then, or requireAdminPassword
    // waves it through anyway), so there is no bootstrap case to special-case.
    if (!(await requireAdminPassword(t('auth.reauth.reasonChangeWorkerAccount')))) return
    setUsernameInput(security.workerUsername ?? '')
    setNewPassword('')
    setConfirmNewPassword('')
    setError(null)
    setShowForm(true)
  }

  const handleSave = async () => {
    const validationError = validateNewPassword({
      username: usernameInput,
      password: newPassword,
      confirmPassword: confirmNewPassword,
    })
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
    // Guarded because both accounts are matched by name at sign-in
    // (authStore's signIn, and the server's own /api/login): two accounts
    // sharing a username would make the worker one permanently unreachable,
    // since admin is tried first.
    if (usernameTakenBy(usernameInput, security.adminUsername)) {
      setError(t('auth.security.workerNameTakenError'))
      return
    }
    setWorkerAccount(usernameInput.trim(), await hashPassword(newPassword))
    setShowForm(false)
    showToast({ tone: 'success', title: t('auth.security.workerAccountSavedToast') })
  }

  const handleRemove = () => {
    requestConfirm(
      {
        title: t('auth.security.removeWorkerConfirmTitle'),
        message: t('auth.security.removeWorkerConfirmMessage'),
        confirmLabel: t('auth.security.removeWorkerAccountButton'),
        tone: 'danger',
      },
      async () => {
        if (!(await requireAdminPassword(t('auth.reauth.reasonChangeWorkerAccount')))) return
        setWorkerAccount(null, null)
        showToast({ tone: 'success', title: t('auth.security.workerAccountRemovedToast') })
      }
    )
  }

  return (
    <div>
      <label className="block text-2xs uppercase font-semibold tracking-wide text-fg-3 mb-1.5">
        {t('auth.security.workerAccountLabel')}
      </label>
      {!showForm ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-text-secondary">
              {isSet
                ? t('auth.security.workerAccountSetStatus', { username: security.workerUsername ?? '' })
                : t('auth.security.workerAccountNotSetStatus')}
            </span>
            <Button variant="secondary" size="sm" icon={HardHat} onClick={handleOpenForm}>
              {isSet ? t('auth.security.changeWorkerAccountButton') : t('auth.security.setWorkerAccountButton')}
            </Button>
            {isSet && (
              <Button variant="ghost" size="sm" onClick={handleRemove}>
                {t('auth.security.removeWorkerAccountButton')}
              </Button>
            )}
          </div>
          <p className="mt-1 text-2xs text-fg-3">{t('auth.security.workerAccountHint')}</p>
        </>
      ) : (
        <div className="max-w-sm space-y-3">
          <CredentialFields
            username={usernameInput}
            onUsernameChange={setUsernameInput}
            password={newPassword}
            onPasswordChange={setNewPassword}
            confirmPassword={confirmNewPassword}
            onConfirmPasswordChange={setConfirmNewPassword}
            autoFocusUsername
            // No revealToggle, no passwordHint — matches this form's
            // original shape exactly, unlike the login screen's two forms.
            // A single submit-time string, attributed to confirmPassword
            // regardless of which rule actually failed — reproducing this
            // form's pre-existing (if slightly rough) behavior verbatim
            // rather than fixing the attribution as a side effect of this
            // extraction.
            errors={{ confirmPassword: error ?? undefined }}
          />
          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={handleSave}>
              {t('settings.saveButton')}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
              {t('common.cancel')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
