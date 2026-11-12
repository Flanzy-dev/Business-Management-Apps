// ensureLanToken is the backfill that closes a real gap: server/shopToken.ts's
// readShopToken treats a missing lanToken as "nothing to demand" and leaves
// the LAN sync server wide open to anyone on the WiFi despite the shop
// already having an admin password to protect. These tests pin the three
// states that matter — mint once, never re-mint, never mint without an
// account — so a future edit can't silently reopen that window.
import '../../__tests__/helpers/nodeLocalStorage'
import { describe, it, expect, beforeEach } from 'vitest'
import { useSecurityStore } from '../../../store/securityStore'
import { ensureSecurityComplete } from '../securityCompleteness'

// The admin-tier token half of securityCompleteness.ts's invariant.
const ensureLanToken = () => ensureSecurityComplete({ isAdminSession: () => false })

describe('ensureLanToken', () => {
  beforeEach(() => {
    useSecurityStore.setState((s) => ({ security: { ...s.security, adminPasswordHash: null, lanToken: null } }))
  })

  it('mints a token when an admin account exists but has none yet', () => {
    useSecurityStore.setState((s) => ({ security: { ...s.security, adminPasswordHash: 'pbkdf2$sha256$...' } }))
    ensureLanToken()
    expect(useSecurityStore.getState().security.lanToken).toEqual(expect.any(String))
    expect(useSecurityStore.getState().security.lanToken).not.toBe('')
  })

  it('is a no-op once a token already exists — never re-mints on a later launch', () => {
    useSecurityStore.setState((s) => ({
      security: { ...s.security, adminPasswordHash: 'pbkdf2$sha256$...', lanToken: 'existing-token' },
    }))
    ensureLanToken()
    expect(useSecurityStore.getState().security.lanToken).toBe('existing-token')
  })

  it('mints nothing for a shop with no admin account yet', () => {
    ensureLanToken()
    expect(useSecurityStore.getState().security.lanToken).toBeNull()
  })
})
