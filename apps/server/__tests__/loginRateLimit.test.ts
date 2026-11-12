import { describe, it, expect } from 'vitest'
import { createLoginRateLimiter } from '../loginRateLimit'

// `now` is passed explicitly throughout rather than mocking the clock — the
// limiter takes it as a parameter for exactly this reason, so a test can
// step 5 minutes forward without sleeping.
const T0 = 1_700_000_000_000

describe('createLoginRateLimiter', () => {
  it('allows the first attempt from an unknown address', () => {
    const limiter = createLoginRateLimiter()
    expect(limiter.check('10.0.0.1', T0)).toEqual({ allowed: true, retryAfterMs: 0 })
  })

  it('does not delay the free attempts — typos must not feel like a lockout', () => {
    const limiter = createLoginRateLimiter()
    for (let i = 0; i < 3; i++) {
      limiter.recordFailure('10.0.0.1', T0)
      expect(limiter.check('10.0.0.1', T0).allowed).toBe(true)
    }
  })

  it('locks out once the free attempts are spent', () => {
    const limiter = createLoginRateLimiter()
    for (let i = 0; i < 4; i++) limiter.recordFailure('10.0.0.1', T0)
    const check = limiter.check('10.0.0.1', T0)
    expect(check.allowed).toBe(false)
    expect(check.retryAfterMs).toBeGreaterThan(0)
  })

  it('escalates the delay with each further failure', () => {
    const limiter = createLoginRateLimiter()
    const delays: number[] = []
    for (let i = 0; i < 8; i++) {
      limiter.recordFailure('10.0.0.1', T0)
      delays.push(limiter.check('10.0.0.1', T0).retryAfterMs)
    }
    const escalating = delays.slice(3)
    for (let i = 1; i < escalating.length; i++) {
      expect(escalating[i]).toBeGreaterThan(escalating[i - 1])
    }
  })

  it('caps the delay at five minutes', () => {
    const limiter = createLoginRateLimiter()
    for (let i = 0; i < 40; i++) limiter.recordFailure('10.0.0.1', T0)
    expect(limiter.check('10.0.0.1', T0).retryAfterMs).toBeLessThanOrEqual(5 * 60_000)
  })

  it('allows again once the lockout window has passed', () => {
    const limiter = createLoginRateLimiter()
    for (let i = 0; i < 4; i++) limiter.recordFailure('10.0.0.1', T0)
    expect(limiter.check('10.0.0.1', T0).allowed).toBe(false)
    expect(limiter.check('10.0.0.1', T0 + 5 * 60_000 + 1).allowed).toBe(true)
  })

  it('keys lockouts per address — one device cannot lock out another', () => {
    // The reason this exists as its own limiter rather than a single global
    // counter: a shop tablet mistyping its password must never stop the
    // owner's PC from pairing.
    const limiter = createLoginRateLimiter()
    for (let i = 0; i < 8; i++) limiter.recordFailure('10.0.0.1', T0)
    expect(limiter.check('10.0.0.1', T0).allowed).toBe(false)
    expect(limiter.check('10.0.0.2', T0).allowed).toBe(true)
  })

  it('clears the lockout on success, so the next typo starts fresh', () => {
    const limiter = createLoginRateLimiter()
    for (let i = 0; i < 8; i++) limiter.recordFailure('10.0.0.1', T0)
    limiter.recordSuccess('10.0.0.1')
    expect(limiter.check('10.0.0.1', T0)).toEqual({ allowed: true, retryAfterMs: 0 })
    // And the count really reset — one more failure must not re-lock.
    limiter.recordFailure('10.0.0.1', T0)
    expect(limiter.check('10.0.0.1', T0).allowed).toBe(true)
  })

  it('expires idle entries instead of growing forever', () => {
    const limiter = createLoginRateLimiter()
    for (let i = 0; i < 8; i++) limiter.recordFailure('10.0.0.1', T0)
    // A later failure from a different address sweeps the stale entry; the
    // old address is then back to a clean slate rather than remembered for
    // the life of the process.
    limiter.recordFailure('10.0.0.2', T0 + 31 * 60_000)
    expect(limiter.check('10.0.0.1', T0 + 31 * 60_000).allowed).toBe(true)
  })

  it('never expires an entry while its lockout is still running', () => {
    const limiter = createLoginRateLimiter()
    for (let i = 0; i < 40; i++) limiter.recordFailure('10.0.0.1', T0)
    // Sweep triggered from elsewhere, one second into the lockout.
    limiter.recordFailure('10.0.0.2', T0 + 1_000)
    expect(limiter.check('10.0.0.1', T0 + 1_000).allowed).toBe(false)
  })
})
