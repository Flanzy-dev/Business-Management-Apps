// ensureAdminRecoveryCode is the backfill that gives an admin account that
// predates recovery codes one — but unlike ensureLanToken.ts's identical
// shape, it can't just check "is one missing", because minting a code means
// DISPLAYING it (see the file's own header): a Worker tablet that happened
// to notice a missing code first would hand Admin to whoever is standing in
// front of it. These tests pin that it only ever fires on a live admin
// session on this device, and only when a code is actually missing.
import '../../__tests__/helpers/nodeLocalStorage'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useSecurityStore } from '../../../store/securityStore'
import { useAuthStore } from '../../../store/authStore'
import { useRecoveryCodeStore } from '../../../store/uiStores'
import { ensureSecurityComplete } from '../securityCompleteness'

// The recovery-code half of securityCompleteness.ts's invariant, with the
// live session read the way App.tsx reads it.
const ensureAdminRecoveryCode = () =>
  ensureSecurityComplete({ isAdminSession: () => useAuthStore.getState().mode === 'admin' })

describe('ensureAdminRecoveryCode', () => {
  beforeEach(() => {
    useSecurityStore.setState((s) => ({
      security: { ...s.security, adminPasswordHash: null, adminRecoveryCodeHash: null },
    }))
    useAuthStore.setState({ mode: null })
    useRecoveryCodeStore.setState({ pendingCode: null })
  })

  it('mints and shows a code for a live admin session missing one', async () => {
    useSecurityStore.setState((s) => ({ security: { ...s.security, adminPasswordHash: 'pbkdf2$sha256$...' } }))
    useAuthStore.setState({ mode: 'admin' })

    ensureAdminRecoveryCode()

    await vi.waitFor(() => expect(useSecurityStore.getState().security.adminRecoveryCodeHash).not.toBeNull())
    expect(useRecoveryCodeStore.getState().pendingCode).toEqual(expect.any(String))
  })

  it('does nothing without an admin account', async () => {
    useAuthStore.setState({ mode: 'admin' })
    ensureAdminRecoveryCode()
    // Nothing async is started in this branch — the missing-hash check
    // returns synchronously, so there is nothing to await.
    expect(useSecurityStore.getState().security.adminRecoveryCodeHash).toBeNull()
    expect(useRecoveryCodeStore.getState().pendingCode).toBeNull()
  })

  it('does nothing once a recovery code already exists', async () => {
    useSecurityStore.setState((s) => ({
      security: { ...s.security, adminPasswordHash: 'pbkdf2$sha256$...', adminRecoveryCodeHash: 'existing-hash' },
    }))
    useAuthStore.setState({ mode: 'admin' })
    ensureAdminRecoveryCode()
    expect(useRecoveryCodeStore.getState().pendingCode).toBeNull()
    expect(useSecurityStore.getState().security.adminRecoveryCodeHash).toBe('existing-hash')
  })

  it('never mints on a Worker session, even if the shop account is missing a code', async () => {
    useSecurityStore.setState((s) => ({ security: { ...s.security, adminPasswordHash: 'pbkdf2$sha256$...' } }))
    useAuthStore.setState({ mode: 'worker' })

    ensureAdminRecoveryCode()

    // Give any wrongly-started async work a chance to run before asserting
    // it never touched anything — this is the exact hazard the file's
    // header warns about (a Worker tablet handing itself Admin's code).
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(useSecurityStore.getState().security.adminRecoveryCodeHash).toBeNull()
    expect(useRecoveryCodeStore.getState().pendingCode).toBeNull()
  })
})
