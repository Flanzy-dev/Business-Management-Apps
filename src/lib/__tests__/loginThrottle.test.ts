// Covers the exponential-backoff schedule itself — src/store/authStore.ts's
// signInAdmin (tested via its own call sites, LockScreen and
// PasswordPromptHost) is what wires this into an actual verify attempt.
import { describe, it, expect, beforeEach } from 'vitest'
import { checkLoginThrottle, recordLoginFailure, recordLoginSuccess, verifyAgainstHash, throttleErrorMessage } from '../auth/loginThrottle'
import { hashPassword } from '../auth/password'

// vitest.config.ts runs this suite under environment: 'node' — see
// syncHostConfig.test.ts's header for why a minimal in-memory polyfill is
// enough here.
class MemoryStorage {
  private store = new Map<string, string>()
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value)
  }
  removeItem(key: string): void {
    this.store.delete(key)
  }
}

beforeEach(() => {
  ;(globalThis as any).localStorage = new MemoryStorage()
})

const T0 = 1_700_000_000_000 // an arbitrary fixed epoch ms, only used as an offset

describe('checkLoginThrottle', () => {
  it('allows the very first attempt', () => {
    expect(checkLoginThrottle(T0)).toEqual({ allowed: true, retryAfterMs: 0 })
  })

  it('allows the first few failures with no delay — ordinary typos', () => {
    recordLoginFailure(T0)
    recordLoginFailure(T0)
    recordLoginFailure(T0)
    expect(checkLoginThrottle(T0)).toEqual({ allowed: true, retryAfterMs: 0 })
  })

  it('locks out after enough consecutive failures, with a positive retryAfterMs', () => {
    for (let i = 0; i < 4; i++) recordLoginFailure(T0)
    const check = checkLoginThrottle(T0)
    expect(check.allowed).toBe(false)
    expect(check.retryAfterMs).toBeGreaterThan(0)
  })

  it('the delay strictly increases with more consecutive failures', () => {
    for (let i = 0; i < 4; i++) recordLoginFailure(T0)
    const afterFour = checkLoginThrottle(T0).retryAfterMs

    for (let i = 0; i < 3; i++) recordLoginFailure(T0) // 7 total now
    const afterSeven = checkLoginThrottle(T0).retryAfterMs

    expect(afterSeven).toBeGreaterThan(afterFour)
  })

  it('caps the delay instead of growing without bound', () => {
    for (let i = 0; i < 30; i++) recordLoginFailure(T0)
    expect(checkLoginThrottle(T0).retryAfterMs).toBeLessThanOrEqual(5 * 60_000)
  })

  it('allows again once the lockout window has elapsed', () => {
    for (let i = 0; i < 4; i++) recordLoginFailure(T0)
    const { retryAfterMs } = checkLoginThrottle(T0)
    expect(checkLoginThrottle(T0 + retryAfterMs).allowed).toBe(true)
  })

  it('recordLoginSuccess resets the count — the next mistyped password gets a fresh set of free attempts', () => {
    for (let i = 0; i < 4; i++) recordLoginFailure(T0)
    expect(checkLoginThrottle(T0).allowed).toBe(false)

    recordLoginSuccess()

    expect(checkLoginThrottle(T0)).toEqual({ allowed: true, retryAfterMs: 0 })
    recordLoginFailure(T0)
    recordLoginFailure(T0)
    recordLoginFailure(T0)
    expect(checkLoginThrottle(T0).allowed).toBe(true) // still within the free-attempts budget again
  })

  it('ignores corrupted stored state instead of permanently locking out', () => {
    localStorage.setItem('auth-lockout', 'not json')
    expect(checkLoginThrottle(T0)).toEqual({ allowed: true, retryAfterMs: 0 })
  })
})

describe('verifyAgainstHash', () => {
  it('succeeds on a correct password with a clean throttle history', async () => {
    const hash = await hashPassword('correct-horse')
    const result = await verifyAgainstHash('correct-horse', hash)
    expect(result).toEqual({ ok: true, retryAfterMs: 0 })
    expect(checkLoginThrottle().allowed).toBe(true)
  })

  it('resets the failure count on success, same as recordLoginSuccess', async () => {
    const hash = await hashPassword('correct-horse')
    await verifyAgainstHash('wrong-guess', hash)
    await verifyAgainstHash('wrong-guess', hash)
    await verifyAgainstHash('correct-horse', hash)
    // The next few wrong guesses should again fall inside the free-attempts
    // budget, not continue counting from where the earlier two left off.
    await verifyAgainstHash('wrong-guess', hash)
    expect(checkLoginThrottle().allowed).toBe(true)
  })

  it('fails with retryAfterMs 0 on a wrong password within the free-attempts budget', async () => {
    const hash = await hashPassword('correct-horse')
    const result = await verifyAgainstHash('wrong-guess', hash)
    expect(result.ok).toBe(false)
    expect(result.retryAfterMs).toBe(0)
  })

  it('reports a positive retryAfterMs once enough consecutive failures have piled up', async () => {
    const hash = await hashPassword('correct-horse')
    for (let i = 0; i < 3; i++) await verifyAgainstHash('wrong-guess', hash)
    const result = await verifyAgainstHash('wrong-guess', hash)
    expect(result.ok).toBe(false)
    expect(result.retryAfterMs).toBeGreaterThan(0)
  })

  it('refuses to even attempt verification once already throttled', async () => {
    const hash = await hashPassword('correct-horse')
    for (let i = 0; i < 10; i++) recordLoginFailure()
    // A correct password should still fail while locked out — the throttle
    // check happens before verifyPassword is ever called.
    const result = await verifyAgainstHash('correct-horse', hash)
    expect(result.ok).toBe(false)
    expect(result.retryAfterMs).toBeGreaterThan(0)
  })
})

describe('throttleErrorMessage', () => {
  const t = (key: string, vars?: Record<string, string | number>) => `${key}${vars ? `:${JSON.stringify(vars)}` : ''}`

  it('shows the wrong-password key when not throttled', () => {
    expect(throttleErrorMessage(0, t, 'auth.lockScreen.wrongPassword')).toBe('auth.lockScreen.wrongPassword')
  })

  it('shows the too-many-attempts key, with seconds rounded up, when throttled', () => {
    expect(throttleErrorMessage(2_500, t, 'auth.lockScreen.wrongPassword')).toBe(
      'auth.lockScreen.tooManyAttempts:{"seconds":3}'
    )
  })

  it('uses whichever wrong-password key the caller passes — LockScreen and PasswordPromptHost differ', () => {
    expect(throttleErrorMessage(0, t, 'auth.reauth.wrongPassword')).toBe('auth.reauth.wrongPassword')
  })
})
