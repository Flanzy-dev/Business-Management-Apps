// The shop's admin-account recovery code — LoginScreen's "Forgot password?"
// path (src/components/auth/ForgotPasswordForm.tsx) verifies one of these
// against src/store/securityStore.ts's adminRecoveryCodeHash to let someone
// set a new admin password without knowing the old one.
//
// Grouped via src/lib/auth/groupedCode.ts, same alphabet as
// src/lib/auth/shopToken.ts's LAN token and for the same reason (read off a
// screen, typed back in by hand) — but longer, because unlike that shared
// secret THIS one is a full admin credential: knowing it and reaching the
// login screen is enough to set a new admin password and sign in. Four
// groups of five is 5 bits/char (32-character alphabet) × 20 characters ≈
// 100 bits, comfortably beyond what the shared exponential backoff
// (src/lib/auth/loginThrottle.ts) needs to make guessing hopeless.
import { generateGroupedCode } from './groupedCode'

const GROUP_LENGTH = 5
const GROUP_COUNT = 4

export function generateRecoveryCode(): string {
  return generateGroupedCode(GROUP_LENGTH, GROUP_COUNT)
}

/**
 * Normalizes a typed-back-in recovery code before hashing or verifying:
 * lowercased, with anything that isn't part of the alphabet (dashes, spaces,
 * a stray character from a bad paste) stripped out. Hashing
 * (src/store/authStore.ts's createAdminPassword / resetAdminPasswordWithRecoveryCode)
 * and verifying (ForgotPasswordForm) both go through this — skip it on
 * either side and a code that is visibly correct fails to verify, which
 * looks like data corruption rather than what it actually is.
 */
export function normalizeRecoveryCode(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]/g, '')
}
