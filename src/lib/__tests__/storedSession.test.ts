// The boot decision: given a session marker on disk and whatever accounts
// the shop currently has, does this device open signed in?
//
// This is the highest-consequence pure logic in the auth layer and the only
// part of it a test can reach (Vitest runs environment: 'node' with no DOM,
// so every component around it is untestable by construction). Two branches
// here are the ones a plausible reimplementation gets wrong, and both are
// asserted below explicitly:
//   1. the legacy bare 'worker' marker must keep resuming, or upgrading the
//      app silently signs out every shop tablet already in the field;
//   2. a cold follower, whose shop data simply hasn't synced yet, must NOT
//      have its marker deleted — "I can't verify this right now" is not the
//      same as "this is invalid".
import { describe, it, expect } from 'vitest'
import {
  parseStoredSession,
  resolveStoredSession,
  serializeStoredSession,
  type KnownAccounts,
  type StoredSession,
} from '../auth/storedSession'

const NO_ACCOUNTS: KnownAccounts = {
  adminUsername: null,
  adminPasswordHash: null,
  workerUsername: null,
  workerPasswordHash: null,
}

const accountsWith = (over: Partial<KnownAccounts>): KnownAccounts => ({ ...NO_ACCOUNTS, ...over })

const SHOP: KnownAccounts = accountsWith({
  adminUsername: 'Flanzy',
  adminPasswordHash: 'pbkdf2$sha256$210000$c2FsdA==$aGFzaA==',
  workerUsername: 'bengkel',
  workerPasswordHash: 'pbkdf2$sha256$210000$c2FsdA==$d29ya2Vy',
})

describe('parseStoredSession', () => {
  it('reads the legacy bare "worker" string written before the format was versioned', () => {
    // Every device upgrading from the previous build has exactly this on
    // disk. A regression here logs all of them out at once.
    expect(parseStoredSession('worker')).toEqual({ v: 1, mode: 'worker', username: null })
  })

  it('round-trips every shape it can write', () => {
    const shapes: StoredSession[] = [
      { v: 1, mode: 'worker', username: null },
      { v: 1, mode: 'worker', username: 'bengkel' },
      { v: 1, mode: 'admin', username: 'Flanzy' },
      { v: 1, mode: 'admin', username: null },
    ]
    for (const shape of shapes) {
      expect(parseStoredSession(serializeStoredSession(shape))).toEqual(shape)
    }
  })

  it('returns null for anything unrecognized, and never throws', () => {
    for (const raw of [null, '', 'admin', 'nonsense', '{', '[]', 'null', '{"mode":"admin"}']) {
      expect(() => parseStoredSession(raw)).not.toThrow()
      expect(parseStoredSession(raw)).toBeNull()
    }
  })

  it('refuses a version it does not understand rather than guessing', () => {
    expect(parseStoredSession('{"v":2,"mode":"admin","username":"Flanzy"}')).toBeNull()
  })

  it('refuses a mode outside the two real ones', () => {
    expect(parseStoredSession('{"v":1,"mode":"superuser","username":"x"}')).toBeNull()
  })

  it('normalizes a blank or non-string username to null', () => {
    expect(parseStoredSession('{"v":1,"mode":"admin","username":"   "}')?.username).toBeNull()
    expect(parseStoredSession('{"v":1,"mode":"admin","username":42}')?.username).toBeNull()
  })
})

describe('resolveStoredSession', () => {
  it('resumes nothing when there is no marker', () => {
    expect(resolveStoredSession(null, SHOP)).toEqual({ mode: null, clearMarker: false })
  })

  it('never deletes a marker it merely failed to understand', () => {
    // Forward compatibility: a marker written by a NEWER build must survive a
    // downgrade, or rolling back the app costs everyone their session.
    for (const raw of ['', '{', 'nonsense', '{"v":99,"mode":"admin"}']) {
      expect(resolveStoredSession(raw, SHOP)).toEqual({ mode: null, clearMarker: false })
    }
  })

  describe('worker — fails open', () => {
    it('resumes the legacy bare marker', () => {
      expect(resolveStoredSession('worker', SHOP)).toEqual({ mode: 'worker', clearMarker: false })
    })

    it('resumes the one-tap marker that names no account', () => {
      const raw = serializeStoredSession({ v: 1, mode: 'worker', username: null })
      expect(resolveStoredSession(raw, SHOP)).toEqual({ mode: 'worker', clearMarker: false })
    })

    it('resumes even when the named worker account no longer exists', () => {
      // Deliberately permissive: refusing would grant nothing, because
      // "Continue as worker" is one unauthenticated tap away on the very
      // screen this device would be bounced to.
      const raw = serializeStoredSession({ v: 1, mode: 'worker', username: 'someone-deleted' })
      expect(resolveStoredSession(raw, NO_ACCOUNTS)).toEqual({ mode: 'worker', clearMarker: false })
    })
  })

  describe('admin — fails closed', () => {
    const adminMarker = (username: string | null) => serializeStoredSession({ v: 1, mode: 'admin', username })

    it('resumes when the marker names the shop admin', () => {
      expect(resolveStoredSession(adminMarker('Flanzy'), SHOP)).toEqual({ mode: 'admin', clearMarker: false })
    })

    it('matches the name case- and whitespace-insensitively, as sign-in does', () => {
      for (const name of ['flanzy', 'FLANZY', '  Flanzy  ']) {
        expect(resolveStoredSession(adminMarker(name), SHOP).mode).toBe('admin')
      }
    })

    it('resumes a legacy shop that has a password but never set a username', () => {
      const legacy = accountsWith({ adminUsername: null, adminPasswordHash: SHOP.adminPasswordHash })
      expect(resolveStoredSession(adminMarker(null), legacy)).toEqual({ mode: 'admin', clearMarker: false })
    })

    it('refuses AND deletes the marker when the admin account was renamed', () => {
      // This is what makes renaming the admin account a working way to sign
      // every other device out.
      const renamed = accountsWith({ adminUsername: 'Budi', adminPasswordHash: SHOP.adminPasswordHash })
      expect(resolveStoredSession(adminMarker('Flanzy'), renamed)).toEqual({ mode: null, clearMarker: true })
    })

    it('refuses a forged name that matches no account', () => {
      expect(resolveStoredSession(adminMarker('intruder'), SHOP)).toEqual({ mode: null, clearMarker: true })
    })

    it('refuses but KEEPS the marker when no shop data has arrived yet', () => {
      // The cold-follower branch, and the one a naive "invalid → delete it"
      // implementation gets wrong. security-store is legitimately empty for
      // the first seconds of every launch on a follower; deleting here would
      // demand a password on every restart, and "stay signed in" would work
      // only on the host. authStore's resume watcher picks this up once sync
      // delivers the accounts.
      expect(resolveStoredSession(adminMarker('Flanzy'), NO_ACCOUNTS)).toEqual({ mode: null, clearMarker: false })
    })

    it('treats the hash, not the username, as proof the account exists', () => {
      // A username with no hash is not an account — server/shopAccounts.ts
      // skips exactly this shape too.
      const halfMade = accountsWith({ adminUsername: 'Flanzy', adminPasswordHash: null })
      expect(resolveStoredSession(adminMarker('Flanzy'), halfMade)).toEqual({ mode: null, clearMarker: false })
    })
  })
})
