import { forwardRef, useImperativeHandle, useRef } from 'react'
import { Input } from '../ui/Input'
import { useTranslation } from '../../lib/i18n'

export type CredentialField = 'username' | 'password' | 'confirmPassword'

export interface CredentialFieldsHandle {
  /** Imperative, not a ref prop — no caller ever touches a raw <input>
   *  element. Each of AdminCreateForm/SignUpForm's "focus the first bad
   *  field on submit" logic calls this instead of the hand-rolled
   *  `refs[firstBad].current?.focus()` both used to carry independently. */
  focus(field: CredentialField): void
}

interface CredentialFieldsProps {
  username: string
  onUsernameChange: (value: string) => void
  password: string
  onPasswordChange: (value: string) => void
  confirmPassword: string
  onConfirmPasswordChange: (value: string) => void
  /** Already-translated messages, not error codes — keeps this component
   *  free of any i18n-key or validation-module knowledge. Each caller keeps
   *  owning WHICH validation it runs (signUpFieldErrors vs
   *  newPasswordFieldErrors vs validateNewPassword) and WHEN an error is
   *  allowed to show (per-field touched state vs a single submit-time
   *  string) — this component only ever renders what it's handed. */
  errors: Partial<Record<CredentialField, string>>
  onBlur?: (field: CredentialField) => void
  autoFocusUsername?: boolean
  /** AdminCreateForm/SignUpForm: true. WorkerAccountSection: false (matches
   *  its current form, which has never offered a reveal toggle). */
  revealToggle?: boolean
  /** Shown under the password field. AdminCreateForm/SignUpForm pass the
   *  MIN_PASSWORD_LENGTH hint; WorkerAccountSection omits it, same as today. */
  passwordHint?: string
}

/**
 * The username + new-password + confirm-password trio duplicated, near
 * verbatim, across AdminCreateForm.tsx, SignUpForm.tsx, and (in a simplified
 * fourth shape) WorkerAccountSection.tsx — fallow's duplication detector
 * flagged the first two directly. Extracted from an
 * /improve-codebase-architecture pass: the validation logic behind these
 * fields (signUpFieldErrors, newPasswordFieldErrors, validateNewPassword) was
 * already a deep, well-tested module; only the *rendering* side never got
 * the same treatment.
 *
 * Deliberately does NOT own touched-state, error computation, or submission
 * — each caller still decides its own validation and error-timing rules.
 * This component owns exactly three things: the three `<Input>` renders, the
 * three internal refs, and imperative focus.
 */
export const CredentialFields = forwardRef<CredentialFieldsHandle, CredentialFieldsProps>(
  (
    {
      username,
      onUsernameChange,
      password,
      onPasswordChange,
      confirmPassword,
      onConfirmPasswordChange,
      errors,
      onBlur,
      autoFocusUsername,
      revealToggle = false,
      passwordHint,
    },
    ref
  ) => {
    const { t } = useTranslation()
    const refs = {
      username: useRef<HTMLInputElement>(null),
      password: useRef<HTMLInputElement>(null),
      confirmPassword: useRef<HTMLInputElement>(null),
    }

    useImperativeHandle(ref, () => ({
      focus: (field) => refs[field].current?.focus(),
    }))

    return (
      <>
        <Input
          ref={refs.username}
          label={t('auth.lockScreen.usernameLabel')}
          name="username"
          autoComplete="username"
          autoFocus={autoFocusUsername}
          autoCapitalize="none"
          autoCorrect="off"
          value={username}
          onChange={(e) => onUsernameChange(e.target.value)}
          onBlur={() => onBlur?.('username')}
          error={errors.username}
        />
        <Input
          ref={refs.password}
          label={t('auth.lockScreen.createLabel')}
          name="new-password"
          type="password"
          revealToggle={revealToggle}
          autoComplete="new-password"
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          onBlur={() => onBlur?.('password')}
          error={errors.password}
          hint={passwordHint}
        />
        <Input
          ref={refs.confirmPassword}
          label={t('auth.lockScreen.confirmLabel')}
          name="confirm-password"
          type="password"
          revealToggle={revealToggle}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => onConfirmPasswordChange(e.target.value)}
          onBlur={() => onBlur?.('confirmPassword')}
          error={errors.confirmPassword}
        />
      </>
    )
  }
)

CredentialFields.displayName = 'CredentialFields'
