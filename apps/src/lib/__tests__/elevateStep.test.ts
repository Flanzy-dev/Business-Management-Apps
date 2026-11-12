// resolveAuthStep is the single most consequential piece of pure logic in
// the elevate-dialog change: get it wrong and a cold follower can be shown
// "create the admin account" while the real one is a moment away from
// syncing in, producing a second admin account that collides with the
// shop's actual one. See src/lib/auth/elevateStep.ts's header.
import { describe, it, expect } from 'vitest'
import { resolveAuthStep } from '../auth/elevateStep'

describe('resolveAuthStep', () => {
  it('goes to sign-in when the shop has an admin account', () => {
    expect(resolveAuthStep('pbkdf2$sha256$210000$salt$hash', null)).toBe('signIn')
  })

  it('goes to create when the shop has no admin account', () => {
    expect(resolveAuthStep(null, null)).toBe('create')
  })

  it('an override always wins over the derived answer, in both directions', () => {
    expect(resolveAuthStep('hash', 'create')).toBe('create')
    expect(resolveAuthStep(null, 'signIn')).toBe('signIn')
  })

  it('the load-bearing case: a create override survives a hash arriving mid-session', () => {
    // Simulates a cold follower whose create form the user has started
    // typing into, and whose sync then delivers the shop's real admin
    // account a moment later. The override must keep the person on the form
    // they're using, not yank them onto sign-in mid-keystroke.
    let override: 'signIn' | 'create' | null = null
    let adminPasswordHash: string | null = null

    expect(resolveAuthStep(adminPasswordHash, override)).toBe('create') // untouched, derived

    override = 'create' // AdminCreateForm's onDirty fires on first keystroke
    expect(resolveAuthStep(adminPasswordHash, override)).toBe('create')

    adminPasswordHash = 'pbkdf2$sha256$210000$salt$hash' // sync delivers the real account
    expect(resolveAuthStep(adminPasswordHash, override)).toBe('create') // override still wins
  })

  it('without a pinned override, a hash arriving mid-session correctly flips an untouched screen', () => {
    // The other half of the same behaviour: a screen nobody has touched yet
    // SHOULD flip from create to sign-in the moment the real account syncs
    // in — that's the whole reason resolveAuthStep is derived and not seeded.
    expect(resolveAuthStep(null, null)).toBe('create')
    expect(resolveAuthStep('pbkdf2$sha256$210000$salt$hash', null)).toBe('signIn')
  })
})
