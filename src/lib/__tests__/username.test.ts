// adminUsernameMatches is the actual security rule of the elevate feature —
// the boundary between "worker credentials cannot elevate" and "a legacy
// shop with no adminUsername on record isn't permanently locked out of
// Admin". See src/lib/auth/username.ts's header for the full reasoning.
import { describe, it, expect } from 'vitest'
import { normalizeUsername, adminUsernameMatches, usernameTakenBy } from '../auth/username'

describe('normalizeUsername', () => {
  it('lowercases and trims', () => {
    expect(normalizeUsername('  Flanzy  ')).toBe('flanzy')
  })

  it('collapses null and empty string to the same value', () => {
    expect(normalizeUsername(null)).toBe(normalizeUsername(''))
  })
})

describe('adminUsernameMatches', () => {
  it('matches exactly', () => {
    expect(adminUsernameMatches('Flanzy', 'Flanzy')).toBe(true)
  })

  it('matches case-insensitively', () => {
    expect(adminUsernameMatches('Flanzy', 'flanzy')).toBe(true)
    expect(adminUsernameMatches('Flanzy', 'FLANZY')).toBe(true)
  })

  it('matches through surrounding whitespace on the typed side', () => {
    expect(adminUsernameMatches('Flanzy', '  Flanzy  ')).toBe(true)
  })

  it('the legacy carve-out: a null adminUsername matches anything typed, including empty', () => {
    // A shop can have a real admin password with no username ever recorded
    // (securityStore.ts's adminUsername doc). Before this leniency existed,
    // such a shop's only door into Admin from another device — the
    // password-only elevate prompt — would have become unreachable the
    // moment a username field was required, since signIn already refuses a
    // candidate with no username to match against.
    expect(adminUsernameMatches(null, 'anything')).toBe(true)
    expect(adminUsernameMatches(null, '')).toBe(true)
  })

  it('once a username IS on record, it is required — no leniency', () => {
    expect(adminUsernameMatches('Flanzy', 'someone-else')).toBe(false)
    expect(adminUsernameMatches('Flanzy', '')).toBe(false)
  })

  it('rejects worker-shaped names the way it rejects any other wrong name', () => {
    // Not a special case in the implementation, but the property this whole
    // feature exists for: signInAsAdmin checks ONLY the admin candidate, so
    // a worker's real username simply fails to match here like any other
    // wrong guess — it is never even compared against the worker account.
    expect(adminUsernameMatches('Flanzy', 'bengkel')).toBe(false)
  })
})

describe('usernameTakenBy', () => {
  it('collides on an exact match', () => {
    expect(usernameTakenBy('Flanzy', 'Flanzy')).toBe(true)
  })

  it('collides case- and whitespace-insensitively', () => {
    expect(usernameTakenBy('  flanzy  ', 'FLANZY')).toBe(true)
  })

  it('does not collide with a different name', () => {
    expect(usernameTakenBy('budi', 'Flanzy')).toBe(false)
  })

  it('never collides when the other account has no name on record', () => {
    expect(usernameTakenBy('anything', null)).toBe(false)
    expect(usernameTakenBy('', null)).toBe(false)
  })

  it('never collides on an empty/whitespace-only typed name — that is usernameRequired\'s job', () => {
    expect(usernameTakenBy('', 'Flanzy')).toBe(false)
    expect(usernameTakenBy('   ', 'Flanzy')).toBe(false)
  })
})
