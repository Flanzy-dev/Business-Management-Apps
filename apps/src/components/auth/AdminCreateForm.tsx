import { FormEvent, useRef, useState } from 'react'
import { Button } from '../ui/Button'
import { CredentialFields, type CredentialFieldsHandle } from './CredentialFields'
import { useAuthStore } from '../../store/authStore'
import {
  MIN_PASSWORD_LENGTH,
  NEW_PASSWORD_FIELD_ORDER,
  newPasswordFieldErrors,
  type NewPasswordField,
} from '../../lib/auth/password'
import { useTranslation } from '../../lib/i18n'

const ERROR_KEYS = {
  usernameRequired: 'auth.lockScreen.usernameRequired',
  tooShort: 'auth.lockScreen.tooShort',
  mismatch: 'auth.lockScreen.mismatch',
} as const

/**
 * LoginScreen's first-run "create the shop's admin account" step.
 *
 * Validation is per-field and live, which is the whole difference from the
 * version this replaces: that one called validateNewPassword on submit,
 * got back a single first-failure-wins string, and rendered it on the LAST
 * input — so "Enter a name for this admin account" appeared underneath
 * *Confirm password*. Each rule now sits under the box it is about, appears
 * only once that box has been left (or a submit was attempted), and clears
 * as it is fixed.
 */
export function AdminCreateForm({ onDirty }: { onDirty?: () => void }) {
  const { t } = useTranslation()
  const createAdminPassword = useAuthStore((s) => s.createAdminPassword)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [touched, setTouched] = useState<Partial<Record<NewPasswordField, boolean>>>({})
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const fieldsRef = useRef<CredentialFieldsHandle>(null)

  const errors = newPasswordFieldErrors({ username, password, confirmPassword })

  /** Nothing is complained about until the user has had a fair chance at it:
   *  a field they have left, or any field once they've tried to submit. */
  const errorFor = (field: NewPasswordField): string | undefined => {
    if (!submitAttempted && !touched[field]) return undefined
    const code = errors[field]
    if (!code) return undefined
    return code === 'tooShort' ? t(ERROR_KEYS.tooShort, { count: MIN_PASSWORD_LENGTH }) : t(ERROR_KEYS[code])
  }

  const markTouched = (field: NewPasswordField) => setTouched((prev) => ({ ...prev, [field]: true }))

  // Tells LoginScreen this form is in use, so a sync that lands mid-typing
  // can't swap the step out from under the person filling it in.
  const handleChange = (setter: (value: string) => void) => (value: string) => {
    onDirty?.()
    setter(value)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setSubmitAttempted(true)

    const firstBad = NEW_PASSWORD_FIELD_ORDER.find((field) => errors[field])
    if (firstBad) {
      fieldsRef.current?.focus(firstBad)
      return
    }

    setSubmitting(true)
    await createAdminPassword(username.trim(), password)
    setSubmitting(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3" noValidate>
      <p className="text-xs text-fg-3 mb-1">{t('auth.lockScreen.createHint')}</p>
      <CredentialFields
        ref={fieldsRef}
        username={username}
        onUsernameChange={handleChange(setUsername)}
        password={password}
        onPasswordChange={handleChange(setPassword)}
        confirmPassword={confirmPassword}
        onConfirmPasswordChange={handleChange(setConfirmPassword)}
        onBlur={markTouched}
        autoFocusUsername
        revealToggle
        passwordHint={t('auth.lockScreen.passwordHint', { count: MIN_PASSWORD_LENGTH })}
        errors={{
          username: errorFor('username'),
          password: errorFor('password'),
          confirmPassword: errorFor('confirmPassword'),
        }}
      />
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? t('auth.lockScreen.verifying') : t('auth.lockScreen.createButton')}
      </Button>
    </form>
  )
}
