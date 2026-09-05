import { describe, it, expect } from 'vitest'
import { verifyPasswordHash } from '../passwordVerify'
import { hashPassword } from '../../src/lib/auth/password'

// The point of this file: server/passwordVerify.ts and
// src/lib/auth/password.ts are two SEPARATE implementations of the same
// scheme — the renderer derives with @noble/hashes and encodes with
// btoa/atob, the server derives with Node's native pbkdf2 and encodes with
// Buffer. Only the renderer ever creates a hash; only the server verifies it
// at POST /api/login. If the two ever disagree, every account login fails
// with "wrong password" and nothing else in the app looks broken.
//
// So these tests deliberately hash with the REAL renderer module rather than
// with a fixture string. A fixture would keep passing if one side drifted.

describe('verifyPasswordHash', () => {
  it('accepts a hash produced by the renderer implementation', async () => {
    const stored = await hashPassword('shop-password-1')
    expect(verifyPasswordHash('shop-password-1', stored)).toBe(true)
  })

  it('rejects the wrong password against a renderer-produced hash', async () => {
    const stored = await hashPassword('shop-password-1')
    expect(verifyPasswordHash('shop-password-2', stored)).toBe(false)
  })

  it('is exact — case and whitespace both matter', async () => {
    const stored = await hashPassword('Rahasia')
    expect(verifyPasswordHash('rahasia', stored)).toBe(false)
    expect(verifyPasswordHash('Rahasia ', stored)).toBe(false)
    expect(verifyPasswordHash('Rahasia', stored)).toBe(true)
  })

  it('handles non-ASCII passwords identically on both sides', async () => {
    // UTF-8 encoding is one of the few places two implementations can
    // silently differ (Buffer.from(s,'utf8') vs the renderer's own encoder).
    const stored = await hashPassword('kunci—rahasia-ñ')
    expect(verifyPasswordHash('kunci—rahasia-ñ', stored)).toBe(true)
  })

  it('never throws on a malformed stored string', () => {
    for (const bad of ['', 'nonsense', 'a$b$c$d', 'pbkdf2$sha256$210000$!!!$!!!', '$$$$']) {
      expect(() => verifyPasswordHash('x', bad)).not.toThrow()
      expect(verifyPasswordHash('x', bad)).toBe(false)
    }
  })

  it('rejects an unrecognized scheme or digest rather than guessing', async () => {
    const stored = await hashPassword('pw')
    expect(verifyPasswordHash('pw', stored.replace('pbkdf2$', 'scrypt$'))).toBe(false)
    expect(verifyPasswordHash('pw', stored.replace('sha256$', 'sha512$'))).toBe(false)
  })

  it('rejects a nonsensical iteration count instead of deriving with it', async () => {
    const stored = await hashPassword('pw')
    const parts = stored.split('$')
    const withIterations = (n: string) => [parts[0], parts[1], n, parts[3], parts[4]].join('$')
    expect(verifyPasswordHash('pw', withIterations('0'))).toBe(false)
    expect(verifyPasswordHash('pw', withIterations('-1'))).toBe(false)
    expect(verifyPasswordHash('pw', withIterations('abc'))).toBe(false)
  })

  it('refuses an absurd iteration count rather than burning the host CPU', async () => {
    // The ceiling exists so a corrupt or hostile security-store row can't
    // turn one login request into a multi-second derivation. Asserted by
    // wall time as well as result: a regression that dropped the check would
    // still return false here (the salt no longer matches), just very slowly.
    const parts = (await hashPassword('pw')).split('$')
    const absurd = [parts[0], parts[1], '999999999', parts[3], parts[4]].join('$')
    const startedAt = Date.now()
    expect(verifyPasswordHash('pw', absurd)).toBe(false)
    expect(Date.now() - startedAt).toBeLessThan(500)
  })
})
