// src/lib/auth/adminDeviceBinding.ts is a pure pre-transform for a backup
// object (no storageAdapter, no zustand, no src/lib/deviceId.ts) — so this
// exercises it directly on plain objects shaped like what
// src/lib/persistence.ts's collectBackup() actually produces:
// `data.security` is a STRING, the raw zustand-persist envelope
// `{"state":{"security":{...}},"version":0}`, not the security object
// itself.
import { describe, it, expect } from 'vitest'
import { readAdminPasswordHashFromBackup, rebindAdminDevice } from '../auth/adminDeviceBinding'

function backupWithSecurity(security: Record<string, unknown> | undefined): Record<string, unknown> {
  return {
    customers: '{"state":{"customers":[]},"version":0}',
    security: security === undefined ? undefined : JSON.stringify({ state: { security }, version: 0 }),
  }
}

describe('readAdminPasswordHashFromBackup', () => {
  it('reads the hash out of a well-formed backup', () => {
    const data = backupWithSecurity({ adminPasswordHash: 'pbkdf2$sha256$1$salt$hash', adminUsername: 'Budi', adminDeviceId: 'dev-a' })
    expect(readAdminPasswordHashFromBackup(data)).toBe('pbkdf2$sha256$1$salt$hash')
  })

  it('returns null when there is no security field at all', () => {
    expect(readAdminPasswordHashFromBackup({ customers: '[]' })).toBeNull()
  })

  it('returns null when security is not a string', () => {
    expect(readAdminPasswordHashFromBackup({ security: { adminPasswordHash: 'x' } })).toBeNull()
  })

  it('returns null when security is null (a store that was never persisted, per collectBackup)', () => {
    expect(readAdminPasswordHashFromBackup({ security: null })).toBeNull()
  })

  it('returns null on unparsable JSON', () => {
    expect(readAdminPasswordHashFromBackup({ security: 'not json' })).toBeNull()
  })

  it('returns null when the envelope has no .state.security', () => {
    expect(readAdminPasswordHashFromBackup({ security: JSON.stringify({ state: {}, version: 0 }) })).toBeNull()
  })

  it('returns null when adminPasswordHash is null (a shop backup taken before any admin password existed)', () => {
    const data = backupWithSecurity({ adminPasswordHash: null, lanToken: null, lanTokenRequired: false })
    expect(readAdminPasswordHashFromBackup(data)).toBeNull()
  })

  it('returns null when adminPasswordHash is an empty string', () => {
    const data = backupWithSecurity({ adminPasswordHash: '' })
    expect(readAdminPasswordHashFromBackup(data)).toBeNull()
  })
})

describe('rebindAdminDevice', () => {
  it('patches adminDeviceId onto a well-formed backup, leaving everything else — including adminUsername — untouched', () => {
    const data = backupWithSecurity({
      adminPasswordHash: 'pbkdf2$sha256$1$salt$hash',
      adminUsername: 'Budi',
      adminDeviceId: 'old-device',
      lanToken: 'shop-token',
      lanTokenRequired: true,
    })
    const result = rebindAdminDevice(data, 'new-device')
    const parsed = JSON.parse(result.security as string)
    expect(parsed.state.security).toEqual({
      adminPasswordHash: 'pbkdf2$sha256$1$salt$hash',
      adminUsername: 'Budi',
      adminDeviceId: 'new-device',
      lanToken: 'shop-token',
      lanTokenRequired: true,
    })
    // Sibling fields in the backup are untouched.
    expect(result.customers).toBe(data.customers)
  })

  it('never mutates the input object', () => {
    const data = backupWithSecurity({ adminPasswordHash: 'hash', adminDeviceId: 'old-device' })
    const originalSecurityString = data.security
    const result = rebindAdminDevice(data, 'new-device')
    expect(data.security).toBe(originalSecurityString) // input untouched
    expect(result).not.toBe(data) // a new object was returned
  })

  it('is a no-op when there is no security field at all', () => {
    const data = { customers: '[]' }
    expect(rebindAdminDevice(data, 'new-device')).toBe(data)
  })

  it('is a no-op when security is not a string', () => {
    const data = { security: { adminPasswordHash: 'x' } }
    expect(rebindAdminDevice(data, 'new-device')).toBe(data)
  })

  it('is a no-op on unparsable JSON', () => {
    const data = { security: 'not json' }
    expect(rebindAdminDevice(data, 'new-device')).toBe(data)
  })

  it('is a no-op when the envelope has no .state.security', () => {
    const data = { security: JSON.stringify({ state: {}, version: 0 }) }
    expect(rebindAdminDevice(data, 'new-device')).toBe(data)
  })

  it('is a no-op when adminPasswordHash is null — nothing to bind a device to', () => {
    const data = backupWithSecurity({ adminPasswordHash: null })
    expect(rebindAdminDevice(data, 'new-device')).toBe(data)
  })

  it('binds even when adminDeviceId was previously unset (undefined), not just when it points elsewhere', () => {
    const data = backupWithSecurity({ adminPasswordHash: 'hash' })
    const result = rebindAdminDevice(data, 'new-device')
    const parsed = JSON.parse(result.security as string)
    expect(parsed.state.security.adminDeviceId).toBe('new-device')
  })
})
