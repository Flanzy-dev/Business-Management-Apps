import { FormEvent, useRef, useState } from 'react'
import { ShieldAlert } from 'lucide-react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { CredentialFields, type CredentialFieldsHandle } from './CredentialFields'
import { useAuthStore } from '../../store/authStore'
import { useSecurityStore } from '../../store/securityStore'
import { useThrottleCountdown } from '../../lib/auth/useThrottleCountdown'
import { hashPassword, MIN_PASSWORD_LENGTH } from '../../lib/auth/password'
import {
  requiresAdminAuthorization,
  signUpFieldErrors,
  SIGN_UP_FIELD_ORDER,
  type SignUpField,
  type SignUpRole,
} from '../../lib/auth/signUpValidation'
import { useTranslation } from '../../lib/i18n'

const ERROR_KEYS = {
  usernameRequired: 'auth.lockScreen.usernameRequired',
  tooShort: 'auth.lockScreen.tooShort',
  mismatch: 'auth.lockScreen.mismatch',
  adminPasswordRequired: 'auth.lockScreen.signUpAdminPasswordRequired',
  nameTaken: 'auth.lockScreen.signUpNameTaken',
} as const

/**
 * LoginScreen's sign-up step — creates the shop's WORKER or ADMIN account
 * from the login screen itself, rather than from Settings (worker) or
 * first-run (admin). Modelled on AdminCreateForm's live-per-field-errors
 * shape, with one addition in front of it: proving you hold the shop's
 * CURRENT admin password before anything is created, whenever the shop
 * already has one — see src/lib/auth/signUpValidation.ts's header for why
 * this can't be an open door the way AdminCreateForm's first-run step is.
 *
 * Owns its own state; no dialog host is mounted behind the login screen
 * (see LoginScreen's header), so every error is shown inline.
 */
export function SignUpForm({ onBack, onDone }: { onBack: () => void; onDone: (notice: string) => void }) {
  const { t } = useTranslation()
  const confirmAdminPassword = useAuthStore((s) => s.confirmAdminPassword)
  const createAdminPassword = useAuthStore((s) => s.createAdminPassword)
  const setWorkerAccount = useSecurityStore((s) => s.setWorkerAccount)
  // A primitive selector, live — a sync landing mid-form (the shop's first
  // admin account arriving on a cold follower) must make the authorize
  // field appear or disappear under the person filling this in, not just at
  // the moment the screen first mounted.
  const adminPasswordHash = useSecurityStore((s) => s.security.adminPasswordHash)
  const adminUsername = useSecurityStore((s) => s.security.adminUsername)
  const workerUsername = useSecurityStore((s) => s.security.workerUsername)

  const [role, setRole] = useState<SignUpRole>('worker')
  const [adminPassword, setAdminPassword] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [replaceAck, setReplaceAck] = useState(false)
  const [touched, setTouched] = useState<Partial<Record<SignUpField, boolean>>>({})
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [adminPasswordError, setAdminPasswordError] = useState<string | null>(null)
  const [retryAt, setRetryAt] = useState<number | null>(null)
  const lockedSeconds = useThrottleCountdown(retryAt)

  // adminPassword isn't part of CredentialFields — it doesn't exist in the
  // other two callers (AdminCreateForm, WorkerAccountSection) — so it keeps
  // its own ref, separate from the shared trio's imperative handle.
  const adminPasswordRef = useRef<HTMLInputElement>(null)
  const fieldsRef = useRef<CredentialFieldsHandle>(null)

  const authRequired = requiresAdminAuthorization(adminPasswordHash)
  const errors = signUpFieldErrors(
    { role, username, password, confirmPassword, adminPassword },
    { adminUsername, adminPasswordHash, workerUsername }
  )

  const errorFor = (field: SignUpField): string | undefined => {
    if (!submitAttempted && !touched[field]) return undefined
    const code = errors[field]
    if (!code) return undefined
    return code === 'tooShort' ? t(ERROR_KEYS.tooShort, { count: MIN_PASSWORD_LENGTH }) : t(ERROR_KEYS[code])
  }

  const markTouched = (field: SignUpField) => setTouched((prev) => ({ ...prev, [field]: true }))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (submitting || lockedSeconds > 0) return
    setSubmitAttempted(true)
    setAdminPasswordError(null)

    if (role === 'admin' && !replaceAck) {
      // Not a field this form's validation module knows about — it's a UI
      // gate, not a data rule — so it's checked here rather than folded into
      // signUpFieldErrors.
      return
    }

    const firstBad = SIGN_UP_FIELD_ORDER.find((field) => errors[field])
    if (firstBad) {
      if (firstBad === 'adminPassword') {
        adminPasswordRef.current?.focus()
      } else {
        fieldsRef.current?.focus(firstBad)
      }
      return
    }

    setSubmitting(true)

    if (authRequired) {
      const result = await confirmAdminPassword(adminPassword)
      if (!result.ok) {
        setSubmitting(false)
        setAdminPassword('')
        if (result.retryAfterMs > 0) {
          setRetryAt(Date.now() + result.retryAfterMs)
        } else {
          setRetryAt(null)
          setAdminPasswordError(t('auth.lockScreen.signUpWrongAdminPassword'))
        }
        return
      }
      // The cold-follower race (src/lib/auth/elevateStep.ts's header):
      // security-store could have changed during that await (the documented
      // "fails open" hazard — a stale offline device's push blanking the
      // whole object, see securityStore.ts's header). Read the STORE
      // directly here rather than adminPasswordHash — that's this render's
      // closure value, captured before the await, and checking it against
      // itself can never observe a change; only a fresh
      // useSecurityStore.getState() read actually re-checks anything.
      if (!requiresAdminAuthorization(useSecurityStore.getState().security.adminPasswordHash)) {
        setSubmitting(false)
        return
      }
    }

    if (role === 'worker') {
      setWorkerAccount(username.trim(), await hashPassword(password))
      setSubmitting(false)
      onDone(t('auth.lockScreen.signUpWorkerDoneMessage'))
      return
    }

    // Admin branch signs this device in immediately — the person just
    // proved they hold the CURRENT admin password (or the shop had none to
    // prove), so an admin session here is not an escalation. Reuses the one
    // carefully documented creation path (mints the LAN token and a
    // recovery code, records adminDeviceId) rather than a near-duplicate
    // that could drift from it.
    await createAdminPassword(username.trim(), password)
    // No setSubmitting(false)/onDone here: createAdminPassword's set({mode:
    // 'admin'}) unmounts this whole screen.
  }

  const roleTile = (value: SignUpRole, label: string, hint: string) => (
    <button
      type="button"
      onClick={() => {
        setRole(value)
        if (value === 'worker') setReplaceAck(false)
      }}
      className={`flex-1 text-left p-2.5 rounded-radius-md border transition-colors focus-ring ${
        role === value ? 'border-accent bg-accent/10' : 'border-border-2 bg-surface-card hover:border-border-3'
      }`}
    >
      <span className="block text-sm font-[540] text-fg-1">{label}</span>
      <span className="block text-2xs text-fg-3 mt-0.5 leading-snug">{hint}</span>
    </button>
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-3" noValidate>
      <p className="text-xs text-fg-3 mb-1">{t('auth.lockScreen.signUpHint')}</p>

      {authRequired && (
        <Input
          ref={adminPasswordRef}
          label={t('auth.lockScreen.signUpAuthorizeLabel')}
          name="admin-password"
          type="password"
          revealToggle
          autoComplete="current-password"
          autoFocus
          value={adminPassword}
          onChange={(e) => setAdminPassword(e.target.value)}
          onBlur={() => markTouched('adminPassword')}
          error={
            lockedSeconds > 0
              ? t('auth.lockScreen.tooManyAttempts', { seconds: lockedSeconds })
              : adminPasswordError ?? errorFor('adminPassword')
          }
        />
      )}

      <div>
        <label className="block text-2xs uppercase font-semibold tracking-wide text-fg-3 mb-1.5">
          {t('auth.lockScreen.signUpRoleLabel')}
        </label>
        <div className="flex gap-2">
          {roleTile('worker', t('auth.lockScreen.signUpRoleWorker'), t('auth.lockScreen.signUpRoleWorkerHint'))}
          {roleTile('admin', t('auth.lockScreen.signUpRoleAdmin'), t('auth.lockScreen.signUpRoleAdminHint'))}
        </div>
      </div>

      {role === 'admin' && (
        <div className="rounded-radius-md border border-danger/40 bg-danger/10 p-2.5 space-y-2">
          <div className="flex gap-2 text-xs text-danger leading-relaxed">
            <ShieldAlert size={15} className="shrink-0 mt-0.5" />
            <span>{t('auth.lockScreen.signUpAdminReplaceWarning')}</span>
          </div>
          <label className="flex items-start gap-2 text-xs text-fg-2 cursor-pointer">
            <input
              type="checkbox"
              className="accent-accent mt-0.5"
              checked={replaceAck}
              onChange={(e) => setReplaceAck(e.target.checked)}
            />
            {t('auth.lockScreen.signUpAdminReplaceAck')}
          </label>
        </div>
      )}

      <CredentialFields
        ref={fieldsRef}
        username={username}
        onUsernameChange={setUsername}
        password={password}
        onPasswordChange={setPassword}
        confirmPassword={confirmPassword}
        onConfirmPasswordChange={setConfirmPassword}
        onBlur={markTouched}
        revealToggle
        passwordHint={t('auth.lockScreen.passwordHint', { count: MIN_PASSWORD_LENGTH })}
        errors={{
          username: errorFor('username'),
          password: errorFor('password'),
          confirmPassword: errorFor('confirmPassword'),
        }}
      />

      <Button
        type="submit"
        variant={role === 'admin' ? 'danger' : 'primary'}
        className="w-full"
        disabled={submitting || lockedSeconds > 0 || (role === 'admin' && !replaceAck)}
      >
        {submitting
          ? t('auth.lockScreen.verifying')
          : role === 'admin'
            ? t('auth.lockScreen.signUpReplaceAdminButton')
            : t('auth.lockScreen.signUpButton')}
      </Button>

      <button
        type="button"
        onClick={onBack}
        className="w-full text-center text-xs text-fg-3 hover:text-fg-2 transition-colors py-1 focus-ring rounded-radius-xs"
      >
        {t('auth.lockScreen.backToSignInLabel')}
      </button>
    </form>
  )
}
