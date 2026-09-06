// The security decisions the LAN server makes, tested without a socket.
//
// Until these four were lifted out of createSyncServer's closure they were
// unreachable except through a real TCP listener — which is why syncServer.test.ts
// boots one in 63 of its 76 tests, and why the same security-store rule is
// asserted twice there, once against pure validateOpBatch and once over HTTP.
// The HTTP tests still matter: they prove the wiring. These prove the rules.
import { describe, it, expect, vi } from 'vitest'
import { tokenMatches, tokenRole, isTokenAuthorized, authenticateLogin } from '../syncServer'
import type { ShopAccount } from '../shopAccounts'

const ADMIN = 'admin-token'
const WORKER = 'worker-token'

/** What presentedTokens() hands these: [header, ?token= query param]. */
const presenting = (...values: (string | null)[]): (string | null)[] =>
  values.length === 2 ? values : [values[0] ?? null, null]

describe('tokenMatches', () => {
  it('matches a value presented in either slot', () => {
    expect(tokenMatches(presenting(ADMIN, null), ADMIN)).toBe(true)
    expect(tokenMatches(presenting(null, ADMIN), ADMIN)).toBe(true)
  })

  it('never matches an unset candidate, even against an empty presentation', () => {
    // A token that isn't configured can't be presented. This is the distinction
    // isTokenAuthorized deliberately does NOT make — see below.
    expect(tokenMatches(presenting(null, null), undefined)).toBe(false)
    expect(tokenMatches(presenting(''), undefined)).toBe(false)
    expect(tokenMatches(presenting(ADMIN), undefined)).toBe(false)
  })

  it('rejects a wrong value of a different length without throwing', () => {
    // timingSafeEqual throws on a length mismatch; safeEqual hashes first
    // precisely so a wrong-length guess is an ordinary false, not a 500.
    expect(() => tokenMatches(presenting('x'), ADMIN)).not.toThrow()
    expect(tokenMatches(presenting('x'), ADMIN)).toBe(false)
  })
})

describe('tokenRole', () => {
  it('reports the tier that was presented', () => {
    expect(tokenRole(presenting(ADMIN), ADMIN, WORKER)).toBe('admin')
    expect(tokenRole(presenting(WORKER), ADMIN, WORKER)).toBe('worker')
  })

  it('prefers admin when one value somehow satisfies both', () => {
    expect(tokenRole(presenting(ADMIN), ADMIN, ADMIN)).toBe('admin')
  })

  it('is null when nothing was presented', () => {
    expect(tokenRole(presenting(null, null), ADMIN, WORKER)).toBeNull()
  })

  it('is null during the bootstrap window, where isTokenAuthorized says yes', () => {
    // The whole reason this is a separate tri-state rather than a boolean:
    // with no token configured the gate is open, but nobody has proved they
    // are admin — which is what validateOpBatch's security-store check needs
    // to know before letting a credential write through.
    const presented = presenting(null, null)
    expect(isTokenAuthorized(presented, undefined, undefined)).toBe(true)
    expect(tokenRole(presented, undefined, undefined)).toBeNull()
  })
})

describe('isTokenAuthorized', () => {
  it('lets everything through while neither tier is configured', () => {
    expect(isTokenAuthorized(presenting(null, null), undefined, undefined)).toBe(true)
  })

  it('accepts either tier once a token exists — a worker device still syncs', () => {
    expect(isTokenAuthorized(presenting(WORKER), ADMIN, WORKER)).toBe(true)
    expect(isTokenAuthorized(presenting(ADMIN), ADMIN, WORKER)).toBe(true)
  })

  it('refuses an unknown value once any tier is configured', () => {
    expect(isTokenAuthorized(presenting('nope'), ADMIN, WORKER)).toBe(false)
    expect(isTokenAuthorized(presenting(null, null), ADMIN, undefined)).toBe(false)
  })

  it('closes as soon as only the worker tier is configured', () => {
    expect(isTokenAuthorized(presenting(null, null), undefined, WORKER)).toBe(false)
  })
})

describe('authenticateLogin', () => {
  const admin: ShopAccount = { role: 'admin', username: 'budi', passwordHash: 'hash-admin' }
  const worker: ShopAccount = { role: 'worker', username: 'andi', passwordHash: 'hash-worker' }
  /** Stands in for PBKDF2 — the real one costs ~20ms a call. */
  const verify = (accepted: string) => vi.fn((password: string) => password === accepted)

  it('returns the matching account when the password is right', () => {
    expect(authenticateLogin([admin, worker], 'budi', 'pw', verify('pw'))).toBe(admin)
    expect(authenticateLogin([admin, worker], 'andi', 'pw', verify('pw'))).toBe(worker)
  })

  it('is null when the password is wrong', () => {
    expect(authenticateLogin([admin], 'budi', 'wrong', verify('pw'))).toBeNull()
  })

  it('trims and case-folds the typed username', () => {
    // Typed on a tablet keyboard: "Budi " failing against "budi" is a support
    // call, not a security boundary.
    expect(authenticateLogin([admin], '  BUDI  ', 'pw', verify('pw'))).toBe(admin)
    expect(authenticateLogin([worker], ' ANDI ', 'pw', verify('pw'))).toBe(worker)
  })

  it('lets a legacy admin with no recorded username sign in under any name', () => {
    // A real, deliberately-supported state (securityStore.ts's adminUsername
    // doc). Without this the account is permanently unreachable over the LAN.
    const legacy: ShopAccount = { role: 'admin', username: null, passwordHash: 'h' }
    expect(authenticateLogin([legacy], 'anything', 'pw', verify('pw'))).toBe(legacy)
  })

  it('does NOT extend that leniency to a worker account', () => {
    const nameless: ShopAccount = { role: 'worker', username: null, passwordHash: 'h' }
    expect(authenticateLogin([nameless], 'anything', 'pw', verify('pw'))).toBeNull()
  })

  it('verifies exactly once whether or not the username exists', () => {
    // The anti-enumeration property: skipping the derivation for an unknown
    // name would answer in ~0ms instead of ~20ms and turn this route into a
    // username oracle. Asserted by call count, which is what makes the wall
    // times equal.
    const known = verify('pw')
    authenticateLogin([admin], 'budi', 'nope', known)
    expect(known).toHaveBeenCalledTimes(1)

    const unknown = verify('pw')
    authenticateLogin([admin], 'no-such-user', 'nope', unknown)
    expect(unknown).toHaveBeenCalledTimes(1)
  })

  it('verifies against a hash that cannot succeed when no account matched', () => {
    // Even a verify() that accepts every password must not authenticate an
    // unknown username — the dummy hash is not any account's.
    const acceptsEverything = vi.fn((_password: string, _hash: string) => true)
    expect(authenticateLogin([admin], 'no-such-user', 'pw', acceptsEverything)).toBeNull()
    expect(acceptsEverything).toHaveBeenCalledTimes(1)
    expect(acceptsEverything.mock.calls[0][1]).not.toBe(admin.passwordHash)
  })

  it('verifies once against an empty account list', () => {
    const v = verify('pw')
    expect(authenticateLogin([], 'budi', 'pw', v)).toBeNull()
    expect(v).toHaveBeenCalledTimes(1)
  })
})
