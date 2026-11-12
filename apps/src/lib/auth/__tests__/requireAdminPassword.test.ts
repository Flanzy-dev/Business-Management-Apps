// requireAdminPassword gates nine Settings danger-zone actions. The
// no-hash carve-out below is deliberate and documented at length in the
// function's own docblock — it exists because the hash can vanish mid-session
// (a stale device's security-store push, or RestoreRecoveryFlow replacing
// every store wholesale) and refusing here would make all nine callers
// silently do nothing with no dialog, no error, no toast. Do not "fix" this
// into a refusal without re-reading that docblock first.
import '../../__tests__/helpers/nodeLocalStorage'
import { describe, it, expect, beforeEach } from 'vitest'
import { useSecurityStore } from '../../../store/securityStore'
import { usePasswordPromptStore } from '../../../store/uiStores'
import { requireAdminPassword } from '../requireAdminPassword'

describe('requireAdminPassword', () => {
  beforeEach(() => {
    useSecurityStore.setState((s) => ({ security: { ...s.security, adminPasswordHash: null } }))
    usePasswordPromptStore.setState({ pending: null })
  })

  it('resolves true immediately, with nothing prompted, when there is no admin hash to verify against', async () => {
    await expect(requireAdminPassword('Clear all data')).resolves.toBe(true)
    expect(usePasswordPromptStore.getState().pending).toBeNull()
  })

  it('opens the password prompt and resolves true once it reports success', async () => {
    useSecurityStore.setState((s) => ({ security: { ...s.security, adminPasswordHash: 'pbkdf2$sha256$...' } }))

    const result = requireAdminPassword('Restore backup')
    expect(usePasswordPromptStore.getState().pending?.message).toBe('Restore backup')

    usePasswordPromptStore.getState().close(true)
    await expect(result).resolves.toBe(true)
  })

  it('resolves false when the prompt is dismissed without verifying', async () => {
    useSecurityStore.setState((s) => ({ security: { ...s.security, adminPasswordHash: 'pbkdf2$sha256$...' } }))

    const result = requireAdminPassword('Become main host')
    usePasswordPromptStore.getState().close(false)
    await expect(result).resolves.toBe(false)
  })
})
