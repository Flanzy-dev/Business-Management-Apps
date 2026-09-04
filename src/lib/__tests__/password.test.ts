// Covers hashPassword/verifyPassword's round trip and its failure modes —
// wrong password, salt uniqueness, and malformed/unknown-version stored
// strings never throwing. Does not cover *who* gets prompted for a
// password or when — that's authStore/session.ts's job, and the route
// matrix is covered separately in permissions.test.ts.
import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword, PBKDF2_ITERATIONS, validateNewPassword, MIN_PASSWORD_LENGTH } from '../auth/password'

describe('hashPassword / verifyPassword', () => {
  it('verifies a password against its own hash', async () => {
    const stored = await hashPassword('bengkel-jaya-123')
    expect(await verifyPassword('bengkel-jaya-123', stored)).toBe(true)
  })

  it('rejects the wrong password', async () => {
    const stored = await hashPassword('correct-horse')
    expect(await verifyPassword('wrong-guess', stored)).toBe(false)
  })

  it('is case-sensitive and exact', async () => {
    const stored = await hashPassword('Password1')
    expect(await verifyPassword('password1', stored)).toBe(false)
    expect(await verifyPassword('Password1 ', stored)).toBe(false)
  })

  it('produces a different hash each time for the same password, from a random salt', async () => {
    const first = await hashPassword('same-password')
    const second = await hashPassword('same-password')
    expect(first).not.toBe(second)
    expect(await verifyPassword('same-password', first)).toBe(true)
    expect(await verifyPassword('same-password', second)).toBe(true)
  })

  it('encodes the scheme, algorithm and iteration count into the stored string', async () => {
    const stored = await hashPassword('anything')
    const [scheme, algorithm, iterations] = stored.split('$')
    expect(scheme).toBe('pbkdf2')
    expect(algorithm).toBe('sha256')
    expect(Number(iterations)).toBe(PBKDF2_ITERATIONS)
  })

  it('never throws on a malformed stored string, and just fails to verify', async () => {
    await expect(verifyPassword('anything', 'not-a-real-hash')).resolves.toBe(false)
    await expect(verifyPassword('anything', '')).resolves.toBe(false)
    await expect(verifyPassword('anything', 'pbkdf2$sha256$abc$notbase64$notbase64')).resolves.toBe(false)
    await expect(verifyPassword('anything', 'pbkdf2$sha256$0$AAAA$AAAA')).resolves.toBe(false)
  })

  it('rejects a stored string from an unrecognized scheme or algorithm', async () => {
    const stored = await hashPassword('anything')
    const [, algorithm, iterations, salt, hash] = stored.split('$')
    await expect(verifyPassword('anything', `bcrypt$${algorithm}$${iterations}$${salt}$${hash}`)).resolves.toBe(
      false
    )
    await expect(verifyPassword('anything', `pbkdf2$sha1$${iterations}$${salt}$${hash}`)).resolves.toBe(false)
  })
})

describe('validateNewPassword', () => {
  const validPassword = 'x'.repeat(MIN_PASSWORD_LENGTH)

  it('accepts a valid username + matching password of sufficient length', () => {
    expect(
      validateNewPassword({ username: 'admin', password: validPassword, confirmPassword: validPassword })
    ).toBeNull()
  })

  it('requires a non-blank username, checked before anything else', () => {
    expect(validateNewPassword({ username: '', password: validPassword, confirmPassword: validPassword })).toBe(
      'usernameRequired'
    )
    expect(validateNewPassword({ username: '   ', password: validPassword, confirmPassword: validPassword })).toBe(
      'usernameRequired'
    )
  })

  it('rejects a password shorter than MIN_PASSWORD_LENGTH', () => {
    const short = 'x'.repeat(MIN_PASSWORD_LENGTH - 1)
    expect(validateNewPassword({ username: 'admin', password: short, confirmPassword: short })).toBe('tooShort')
  })

  it('rejects a password/confirmation mismatch', () => {
    expect(
      validateNewPassword({ username: 'admin', password: validPassword, confirmPassword: validPassword + 'x' })
    ).toBe('mismatch')
  })

  it('checks length before mismatch — a too-short password reports tooShort even if confirmation also differs', () => {
    expect(validateNewPassword({ username: 'admin', password: 'x', confirmPassword: 'y' })).toBe('tooShort')
  })
})
