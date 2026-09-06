// signInFieldShape decides whether the login screen asks for a username at
// all. Get it wrong and either a legacy no-username admin's form becomes
// permanently unsubmittable, or a shop with two accounts loses the only way
// to say which one is signing in. See src/lib/auth/accountShape.ts's header.
import { describe, it, expect } from 'vitest'
import { hasAdminAccount, hasWorkerAccount, signInFieldShape, type KnownAccounts } from '../auth/accountShape'

const NONE: KnownAccounts = {
  adminUsername: null,
  adminPasswordHash: null,
  workerUsername: null,
  workerPasswordHash: null,
}

describe('hasAdminAccount', () => {
  it('true whenever a hash is set, regardless of username', () => {
    expect(hasAdminAccount({ ...NONE, adminPasswordHash: 'hash' })).toBe(true)
    expect(hasAdminAccount({ ...NONE, adminPasswordHash: 'hash', adminUsername: null })).toBe(true)
  })

  it('false with no hash', () => {
    expect(hasAdminAccount(NONE)).toBe(false)
  })
})

describe('hasWorkerAccount', () => {
  it('true only when BOTH username and hash are set', () => {
    expect(hasWorkerAccount({ ...NONE, workerUsername: 'budi', workerPasswordHash: 'hash' })).toBe(true)
  })

  it('a half-made worker (one field set, not the other) does not count', () => {
    expect(hasWorkerAccount({ ...NONE, workerUsername: 'budi', workerPasswordHash: null })).toBe(false)
    expect(hasWorkerAccount({ ...NONE, workerUsername: null, workerPasswordHash: 'hash' })).toBe(false)
  })
})

describe('signInFieldShape', () => {
  it('admin-only shop: password-only with the admin username', () => {
    const accounts = { ...NONE, adminPasswordHash: 'hash', adminUsername: 'Budi' }
    expect(signInFieldShape(accounts)).toEqual({ kind: 'passwordOnly', username: 'Budi' })
  })

  it('admin-only shop with no recorded username: password-only, submitting an empty string', () => {
    const accounts = { ...NONE, adminPasswordHash: 'hash', adminUsername: null }
    expect(signInFieldShape(accounts)).toEqual({ kind: 'passwordOnly', username: '' })
  })

  it('worker-only "shop": password-only with the worker username', () => {
    const accounts = { ...NONE, workerUsername: 'Siti', workerPasswordHash: 'hash' }
    expect(signInFieldShape(accounts)).toEqual({ kind: 'passwordOnly', username: 'Siti' })
  })

  it('both accounts: ask which one', () => {
    const accounts: KnownAccounts = {
      adminPasswordHash: 'hash',
      adminUsername: 'Budi',
      workerUsername: 'Siti',
      workerPasswordHash: 'hash2',
    }
    expect(signInFieldShape(accounts)).toEqual({ kind: 'askUsername' })
  })

  it('no accounts at all: ask (nothing to submit password-only against)', () => {
    expect(signInFieldShape(NONE)).toEqual({ kind: 'askUsername' })
  })

  it('a half-made worker does not count as a second account: admin stays password-only', () => {
    const accounts = { ...NONE, adminPasswordHash: 'hash', adminUsername: 'Budi', workerUsername: 'Siti' }
    expect(signInFieldShape(accounts)).toEqual({ kind: 'passwordOnly', username: 'Budi' })
  })
})
