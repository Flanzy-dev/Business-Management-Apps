// Exponential backoff on admin-password attempts, shared by every place a
// guess gets verified against the stored hash — src/store/authStore.ts's
// signInAdmin (the lock screen) and src/components/auth/PasswordPromptHost.tsx
// (the re-auth dialog for Settings' danger-zone actions). Both call
// checkLoginThrottle()/recordLoginFailure()/recordLoginSuccess() below rather
// than comparing against the hash directly, so there's exactly one place
// this can be bypassed from, not two.
//
// Why this exists: the only prior throttle was PBKDF2's own cost (~100-300ms
// per guess in a browser — see password.ts's threat-model comment), and this
// app is deliberately served over plain http:// to LAN tablets (see
// server/syncServer.ts), so any device on the shop's WiFi can drive
// signInAdmin in a devtools loop. With MIN_PASSWORD_LENGTH = 6 and no
// complexity rule, a 6-digit numeric password is ~10^6 guesses — hours, not
// years, with no backoff. This turns that into a schedule where a handful of
// free retries (typos happen) is followed by a rapidly escalating wait.
//
// Persisted to a device-local key (not synced, not backed up — see
// src/lib/storageKeys.ts's DEVICE_LOCAL_KEYS) so a page reload doesn't reset
// it, and so one device's lockout never blocks a different device's
// legitimate admin from signing in there.
import { storageAdapter } from '../storageAdapter'
import { DEVICE_LOCAL_KEYS } from '../storageKeys'
import { verifyPassword } from './password'

const THROTTLE_KEY = DEVICE_LOCAL_KEYS.authLockout

/** Wrong guesses this many or fewer produce no delay at all — ordinary typos
 *  should never feel like a lockout. */
const FREE_ATTEMPTS = 3
const BASE_DELAY_MS = 2_000
const MAX_DELAY_MS = 5 * 60_000

interface ThrottleState {
  failCount: number
  lockedUntil: number | null
}

function readState(): ThrottleState {
  const raw = storageAdapter.getItem(THROTTLE_KEY)
  if (!raw) return { failCount: 0, lockedUntil: null }
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed?.failCount === 'number') {
      return { failCount: parsed.failCount, lockedUntil: typeof parsed.lockedUntil === 'number' ? parsed.lockedUntil : null }
    }
  } catch {
    // Corrupted state reads as "no lockout" — the worst case is one extra
    // free guess, not a permanent lockout with no way out.
  }
  return { failCount: 0, lockedUntil: null }
}

function writeState(state: ThrottleState): void {
  storageAdapter.setItem(THROTTLE_KEY, JSON.stringify(state))
}

/** Delay for the Nth consecutive failure (N > FREE_ATTEMPTS), doubling each
 *  time and capped at MAX_DELAY_MS — e.g. 2s, 4s, 8s, ... up to 5 minutes. */
function delayForFailCount(failCount: number): number {
  if (failCount <= FREE_ATTEMPTS) return 0
  const exponent = failCount - FREE_ATTEMPTS - 1
  return Math.min(BASE_DELAY_MS * 2 ** exponent, MAX_DELAY_MS)
}

export interface ThrottleCheck {
  allowed: boolean
  /** Only meaningful when allowed is false. */
  retryAfterMs: number
}

/** Call before attempting to verify a password. Does not itself count as an
 *  attempt — call recordLoginFailure()/recordLoginSuccess() after the actual
 *  verify. */
export function checkLoginThrottle(now: number = Date.now()): ThrottleCheck {
  const state = readState()
  if (state.lockedUntil && state.lockedUntil > now) {
    return { allowed: false, retryAfterMs: state.lockedUntil - now }
  }
  return { allowed: true, retryAfterMs: 0 }
}

/** Call after a failed verify. */
export function recordLoginFailure(now: number = Date.now()): void {
  const state = readState()
  const failCount = state.failCount + 1
  const delay = delayForFailCount(failCount)
  writeState({ failCount, lockedUntil: delay > 0 ? now + delay : null })
}

/** Call after a successful verify — clears the count so the next mistyped
 *  password starts a fresh set of free attempts, not where this one left off. */
export function recordLoginSuccess(): void {
  writeState({ failCount: 0, lockedUntil: null })
}

export interface VerifyOutcome {
  ok: boolean
  /** Only meaningful when ok is false — 0 means "just a wrong password", >0
   *  means "throttled, retry after this many ms" (which may itself be the
   *  delay this very failure just triggered). */
  retryAfterMs: number
}

/**
 * The throttle-then-verify-then-record sequence shared by every place a
 * password guess gets checked against a stored hash — pulled out of
 * LoginScreen's restore-recovery flow, which had it hand-written inline
 * (authStore.ts's signInAdmin implements the identical sequence itself, with
 * its own extra admin-device-binding step interleaved; left as-is rather
 * than rebuilt on this to avoid touching that critical, already-tested path
 * as a side effect of this cleanup).
 */
export async function verifyAgainstHash(password: string, hash: string): Promise<VerifyOutcome> {
  const throttle = checkLoginThrottle()
  if (!throttle.allowed) return { ok: false, retryAfterMs: throttle.retryAfterMs }

  const ok = await verifyPassword(password, hash)
  if (ok) {
    recordLoginSuccess()
    return { ok: true, retryAfterMs: 0 }
  }
  recordLoginFailure()
  return { ok: false, retryAfterMs: checkLoginThrottle().retryAfterMs }
}

/**
 * Which error text a failed verify shows — the identical two-key ternary
 * that used to be hand-written at every call site (LoginScreen's sign-in and
 * restore-recovery forms, PasswordPromptHost's re-auth dialog, and
 * authStore.ts's own signInAdmin caller). `wrongPasswordKey` differs by
 * caller (LoginScreen uses 'auth.lockScreen.wrongPassword',
 * PasswordPromptHost uses 'auth.reauth.wrongPassword') since the two screens
 * don't share an i18n namespace.
 */
/**
 * Whole seconds left until `retryAt` (an epoch ms deadline), never negative,
 * and 0 for null. Pure so a component can re-render on a 1s interval and
 * show a countdown that actually moves — throttleErrorMessage below renders
 * a number that is correct once and then frozen, which reads as a stuck
 * screen during a 5-minute lockout.
 */
export function secondsRemaining(retryAt: number | null, now: number = Date.now()): number {
  if (retryAt === null) return 0
  return Math.max(0, Math.ceil((retryAt - now) / 1000))
}

export function throttleErrorMessage(
  retryAfterMs: number,
  t: (key: string, vars?: Record<string, string | number>) => string,
  wrongPasswordKey: string
): string {
  return retryAfterMs > 0
    ? t('auth.lockScreen.tooManyAttempts', { seconds: Math.ceil(retryAfterMs / 1000) })
    : t(wrongPasswordKey)
}
