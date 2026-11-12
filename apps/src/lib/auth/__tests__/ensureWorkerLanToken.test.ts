// Mirrors ensureLanToken.test.ts exactly, against the worker-tier fields —
// see ensureWorkerLanToken.ts's header for why this is a SEPARATE token
// rather than reusing the admin one: server/syncServer.ts's validateOpBatch
// refuses a security-store write unless the presented token is specifically
// the admin-tier one, which is what stops a worker-obtained credential from
// rewriting the shop's admin password over the LAN. The last test pins that
// boundary directly.
import '../../__tests__/helpers/nodeLocalStorage'
import { describe, it, expect, beforeEach } from 'vitest'
import { useSecurityStore } from '../../../store/securityStore'
import { ensureSecurityComplete } from '../securityCompleteness'

// The worker-tier token half of securityCompleteness.ts's invariant.
const ensureWorkerLanToken = () => ensureSecurityComplete({ isAdminSession: () => false })

describe('ensureWorkerLanToken', () => {
  beforeEach(() => {
    useSecurityStore.setState((s) => ({
      security: { ...s.security, workerPasswordHash: null, workerLanToken: null, lanToken: null },
    }))
  })

  it('mints a token when a worker account exists but has none yet', () => {
    useSecurityStore.setState((s) => ({ security: { ...s.security, workerPasswordHash: 'pbkdf2$sha256$...' } }))
    ensureWorkerLanToken()
    expect(useSecurityStore.getState().security.workerLanToken).toEqual(expect.any(String))
    expect(useSecurityStore.getState().security.workerLanToken).not.toBe('')
  })

  it('is a no-op once a worker token already exists', () => {
    useSecurityStore.setState((s) => ({
      security: { ...s.security, workerPasswordHash: 'pbkdf2$sha256$...', workerLanToken: 'existing-worker-token' },
    }))
    ensureWorkerLanToken()
    expect(useSecurityStore.getState().security.workerLanToken).toBe('existing-worker-token')
  })

  it('mints nothing for a shop with no worker account yet', () => {
    ensureWorkerLanToken()
    expect(useSecurityStore.getState().security.workerLanToken).toBeNull()
  })

  it('writes the worker token only — the admin lanToken is a distinct credential and stays untouched', () => {
    useSecurityStore.setState((s) => ({ security: { ...s.security, workerPasswordHash: 'pbkdf2$sha256$...' } }))
    ensureWorkerLanToken()
    expect(useSecurityStore.getState().security.lanToken).toBeNull()
  })
})
