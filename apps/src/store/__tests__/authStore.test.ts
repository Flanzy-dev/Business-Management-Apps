// signIn is the one door every device actually uses to reach either role
// (the elevate dialog's signInAsAdmin is a separate, admin-only path). These
// tests exist because of a real regression: signIn used to require BOTH a
// role's username and its hash to be truthy before even comparing names,
// which silently skipped the admin candidate whenever adminUsername was
// null — a real, documented state (see securityStore.ts's adminUsername doc
// and src/lib/__tests__/storedSession.test.ts's "resumes a legacy shop that
// has a password but never set a username"). signInAsAdmin already handled
// that case correctly via adminUsernameMatches; signIn did not, so a legacy
// shop's admin password worked at the elevate dialog but never at the
// ordinary sign-in form — exactly the bug a user hit in the field.
import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from '../authStore'
import { useSecurityStore } from '../securityStore'
import { hashPassword } from '../../lib/auth/password'

// Same in-memory polyfill as src/lib/__tests__/loginThrottle.test.ts — this
// project's Vitest runs environment: 'node', and signIn touches storage
// three ways: securityStore's persist, the login throttle, and the stored
// session marker.
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
  useSecurityStore.setState({
    security: {
      adminPasswordHash: null,
      adminUsername: null,
      workerPasswordHash: null,
      workerUsername: null,
      adminDeviceId: null,
      lanToken: null,
      workerLanToken: null,
      lanTokenRequired: false,
      adminRecoveryCodeHash: null,
    },
  })
  useAuthStore.setState({ mode: null })
})

describe('signIn', () => {
  it('signs in as admin on an exact username + password match', async () => {
    const hash = await hashPassword('correct-horse')
    useSecurityStore.setState((s) => ({ security: { ...s.security, adminUsername: 'Flanzy', adminPasswordHash: hash } }))

    const result = await useAuthStore.getState().signIn('Flanzy', 'correct-horse')
    expect(result).toEqual({ ok: true, role: 'admin', retryAfterMs: 0 })
    expect(useAuthStore.getState().mode).toBe('admin')
  })

  it('matches the admin username case- and whitespace-insensitively', async () => {
    const hash = await hashPassword('correct-horse')
    useSecurityStore.setState((s) => ({ security: { ...s.security, adminUsername: 'Flanzy', adminPasswordHash: hash } }))

    const result = await useAuthStore.getState().signIn('  flanzy  ', 'correct-horse')
    expect(result.ok).toBe(true)
    expect(result.role).toBe('admin')
  })

  it('regression: signs in as admin even when adminUsername was never recorded (legacy shop)', async () => {
    // The exact bug: a real admin password with no adminUsername on record.
    // Before the fix, this candidate was skipped outright regardless of what
    // was typed — no password could ever sign in through this form.
    const hash = await hashPassword('correct-horse')
    useSecurityStore.setState((s) => ({ security: { ...s.security, adminUsername: null, adminPasswordHash: hash } }))

    const result = await useAuthStore.getState().signIn('anything', 'correct-horse')
    expect(result).toEqual({ ok: true, role: 'admin', retryAfterMs: 0 })
    expect(useAuthStore.getState().mode).toBe('admin')
  })

  it('rejects a wrong password for a legacy shop with no adminUsername, rather than granting anything typed', async () => {
    const hash = await hashPassword('correct-horse')
    useSecurityStore.setState((s) => ({ security: { ...s.security, adminUsername: null, adminPasswordHash: hash } }))

    const result = await useAuthStore.getState().signIn('anything', 'wrong-password')
    expect(result.ok).toBe(false)
    expect(useAuthStore.getState().mode).toBeNull()
  })

  it('signs in as worker on an exact match', async () => {
    const hash = await hashPassword('bengkel-pass')
    useSecurityStore.setState((s) => ({ security: { ...s.security, workerUsername: 'bengkel', workerPasswordHash: hash } }))

    const result = await useAuthStore.getState().signIn('bengkel', 'bengkel-pass')
    expect(result).toEqual({ ok: true, role: 'worker', retryAfterMs: 0 })
    expect(useAuthStore.getState().mode).toBe('worker')
  })

  it('does NOT extend admin-style leniency to a missing worker username', async () => {
    // Unlike admin, workerUsername/workerPasswordHash always move together
    // (setWorkerAccount writes both in one call) — a null workerUsername
    // means no worker account exists at all, so nothing should match here.
    const hash = await hashPassword('bengkel-pass')
    useSecurityStore.setState((s) => ({ security: { ...s.security, workerUsername: null, workerPasswordHash: hash } }))

    const result = await useAuthStore.getState().signIn('anything', 'bengkel-pass')
    expect(result.ok).toBe(false)
  })

  it('tries admin before worker when both accounts share a username', async () => {
    const sharedName = 'shop'
    const adminHash = await hashPassword('admin-pass')
    const workerHash = await hashPassword('worker-pass')
    useSecurityStore.setState((s) => ({
      security: {
        ...s.security,
        adminUsername: sharedName,
        adminPasswordHash: adminHash,
        workerUsername: sharedName,
        workerPasswordHash: workerHash,
      },
    }))

    const result = await useAuthStore.getState().signIn(sharedName, 'admin-pass')
    expect(result.role).toBe('admin')
  })

  it('rejects an unknown username', async () => {
    const hash = await hashPassword('correct-horse')
    useSecurityStore.setState((s) => ({ security: { ...s.security, adminUsername: 'Flanzy', adminPasswordHash: hash } }))

    const result = await useAuthStore.getState().signIn('someone-else', 'correct-horse')
    expect(result.ok).toBe(false)
    expect(result.role).toBeNull()
  })

  it('rejects when no account exists at all', async () => {
    const result = await useAuthStore.getState().signIn('anyone', 'anything')
    expect(result.ok).toBe(false)
  })
})
describe('signInAsAdmin (the double-click-profile elevate dialog)', () => {
  it('signs in on an exact username + password match', async () => {
    const hash = await hashPassword('correct-horse')
    useSecurityStore.setState((s) => ({ security: { ...s.security, adminUsername: 'Flanzy', adminPasswordHash: hash } }))

    const result = await useAuthStore.getState().signInAsAdmin('Flanzy', 'correct-horse')
    expect(result).toEqual({ ok: true, retryAfterMs: 0 })
    expect(useAuthStore.getState().mode).toBe('admin')
  })

  it('already handled the legacy no-adminUsername case correctly (this path was never the bug)', async () => {
    // Same fixture as signIn's regression test above — asserted here too so
    // a future change can't fix one door and quietly break the other, which
    // is exactly the shape of bug this whole file exists to catch.
    const hash = await hashPassword('correct-horse')
    useSecurityStore.setState((s) => ({ security: { ...s.security, adminUsername: null, adminPasswordHash: hash } }))

    const result = await useAuthStore.getState().signInAsAdmin('anything', 'correct-horse')
    expect(result).toEqual({ ok: true, retryAfterMs: 0 })
    expect(useAuthStore.getState().mode).toBe('admin')
  })

  it('rejects a wrong username once one is on record, unlike the legacy carve-out above', async () => {
    const hash = await hashPassword('correct-horse')
    useSecurityStore.setState((s) => ({ security: { ...s.security, adminUsername: 'Flanzy', adminPasswordHash: hash } }))

    const result = await useAuthStore.getState().signInAsAdmin('someone-else', 'correct-horse')
    expect(result.ok).toBe(false)
    expect(useAuthStore.getState().mode).toBeNull()
  })

  it('never checks the worker account — worker credentials cannot elevate', async () => {
    const workerHash = await hashPassword('bengkel-pass')
    useSecurityStore.setState((s) => ({
      security: { ...s.security, adminUsername: 'Flanzy', adminPasswordHash: null, workerUsername: 'bengkel', workerPasswordHash: workerHash },
    }))

    const result = await useAuthStore.getState().signInAsAdmin('bengkel', 'bengkel-pass')
    expect(result.ok).toBe(false)
  })
})
