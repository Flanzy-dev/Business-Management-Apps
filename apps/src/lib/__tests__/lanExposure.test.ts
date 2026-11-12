import { describe, expect, it } from 'vitest'
import { isLanOpen, type LanExposureInput } from '../auth/lanExposure'

const open: LanExposureInput = { hostsLanServer: true, syncRole: 'main', adminPasswordHash: null, lanTokenRequired: false }

describe('isLanOpen', () => {
  it('is open on a shop PC with no admin password', () => {
    expect(isLanOpen(open)).toBe(true)
  })

  it('closes once an admin password exists', () => {
    expect(isLanOpen({ ...open, adminPasswordHash: 'pbkdf2$…' })).toBe(false)
  })

  it('closes when the shop switched the LAN token on by hand', () => {
    expect(isLanOpen({ ...open, lanTokenRequired: true })).toBe(false)
  })

  it('does not apply to a browser tab, which serves nothing', () => {
    expect(isLanOpen({ ...open, hostsLanServer: false })).toBe(false)
  })

  it('does not apply to a follower, which listens on localhost only', () => {
    expect(isLanOpen({ ...open, syncRole: 'follower' })).toBe(false)
  })
})
