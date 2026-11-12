// Validation for LoginScreen's sign-up step (src/components/auth/SignUpForm.tsx)
// — the one place someone can create the shop's worker OR admin account from
// the login screen itself, rather than from Settings or first-run.
//
// Pure and store-free on purpose, same reason as src/lib/auth/elevateStep.ts:
// this project's Vitest runs with environment: 'node' and no DOM, so this is
// the only kind of module a test can exercise directly — SignUpForm itself
// is not otherwise testable at all.
import {
  newPasswordFieldErrors,
  type NewPasswordField,
  type PasswordValidationError,
} from './password'
import { usernameTakenBy } from './username'

export type SignUpRole = 'admin' | 'worker'

export type SignUpField = NewPasswordField | 'adminPassword'

export type SignUpError = PasswordValidationError | 'adminPasswordRequired' | 'nameTaken'

export type SignUpFieldErrors = Partial<Record<SignUpField, SignUpError>>

/** Precedence for "focus the first bad field on submit" — the authorizing
 *  password comes first because nothing else on the form matters until that
 *  check can even be attempted. */
export const SIGN_UP_FIELD_ORDER: readonly SignUpField[] = ['adminPassword', 'username', 'password', 'confirmPassword']

/**
 * Whether the form must collect and verify the CURRENT admin password before
 * creating anything. True exactly when the shop already has an admin account
 * — a shop with none yet is still on LoginScreen's derived first-run
 * AdminCreateForm step (src/lib/auth/elevateStep.ts), which this form never
 * replaces.
 */
export function requiresAdminAuthorization(adminPasswordHash: string | null): boolean {
  return !!adminPasswordHash
}

export interface SignUpInput {
  role: SignUpRole
  username: string
  password: string
  confirmPassword: string
  /** Only meaningful when requiresAdminAuthorization() is true. */
  adminPassword: string
}

export interface SignUpKnownAccounts {
  adminUsername: string | null
  adminPasswordHash: string | null
  workerUsername: string | null
}

/**
 * Every rule that currently fails, keyed by the field it belongs to — the
 * same reports-all shape as password.ts's newPasswordFieldErrors, which this
 * builds on rather than restating (the exact anti-drift reason that function
 * was extracted in the first place: a rule fixed here and missed there, or
 * vice versa, would be a real and easy-to-miss divergence).
 *
 * Two rules on top of the three base ones:
 *  - adminPasswordRequired: the shop has an existing admin to authorize
 *    against, and the field is empty. Whether the typed password is actually
 *    CORRECT is not decided here — that needs an async hash check
 *    (authStore's confirmAdminPassword), which this pure, sync function
 *    can't do and shouldn't try to.
 *  - nameTaken: the typed name collides with the OTHER slot's account. Two
 *    accounts sharing a name would make the worker one permanently
 *    unreachable, since authStore's signIn always tries admin first.
 */
export function signUpFieldErrors(input: SignUpInput, accounts: SignUpKnownAccounts): SignUpFieldErrors {
  const errors: SignUpFieldErrors = { ...newPasswordFieldErrors(input) }

  if (requiresAdminAuthorization(accounts.adminPasswordHash) && !input.adminPassword) {
    errors.adminPassword = 'adminPasswordRequired'
  }

  if (!errors.username) {
    const otherUsername = input.role === 'admin' ? accounts.workerUsername : accounts.adminUsername
    if (usernameTakenBy(input.username, otherUsername)) {
      errors.username = 'nameTaken'
    }
  }

  return errors
}
