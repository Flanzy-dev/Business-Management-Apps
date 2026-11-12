// The pure statement of the invariant. ensureLanToken / ensureWorkerLanToken /
// ensureAdminRecoveryCode .test.ts drive ensureSecurityComplete against the
// real store, one credential each; this pins the rule itself.
import '../../__tests__/helpers/nodeLocalStorage'
import { describe, it, expect } from 'vitest'
import { missingSecurityFields } from '../securityCompleteness'

const none = { adminPasswordHash: null, lanToken: null, adminRecoveryCodeHash: null, workerPasswordHash: null, workerLanToken: null }

describe('missingSecurityFields', () => {
  it('asks for nothing before any account exists', () => {
    expect(missingSecurityFields(none)).toEqual([])
  })

  it('an admin account needs its LAN token and a recovery code', () => {
    expect(missingSecurityFields({ ...none, adminPasswordHash: 'h' })).toEqual(['lanToken', 'adminRecoveryCode'])
  })

  it('a worker account needs its own token, never the admin one', () => {
    expect(missingSecurityFields({ ...none, workerPasswordHash: 'h' })).toEqual(['workerLanToken'])
  })

  it('is complete once every account has what goes with it', () => {
    expect(missingSecurityFields({
      adminPasswordHash: 'h', lanToken: 't', adminRecoveryCodeHash: 'r', workerPasswordHash: 'w', workerLanToken: 'wt',
    })).toEqual([])
  })
})
