import { describe, it, expect } from 'vitest'
import { generateRecoveryCode, normalizeRecoveryCode } from '../auth/recoveryCode'
import { hashPassword, verifyPassword } from '../auth/password'

describe('generateRecoveryCode', () => {
  it('produces four dash-separated groups of five characters', () => {
    const code = generateRecoveryCode()
    const groups = code.split('-')
    expect(groups).toHaveLength(4)
    for (const group of groups) expect(group).toHaveLength(5)
  })

  it('excludes easily-confused characters (0/O, 1/I/l) and non-alphabet characters', () => {
    const code = generateRecoveryCode()
    expect(code).toMatch(/^[a-hj-km-np-z2-9]{5}(-[a-hj-km-np-z2-9]{5}){3}$/)
  })

  it('is not the same code twice in a row', () => {
    // Not a proof of randomness, just a smoke test that this isn't a static string.
    const codes = new Set(Array.from({ length: 20 }, () => generateRecoveryCode()))
    expect(codes.size).toBe(20)
  })
})

describe('normalizeRecoveryCode', () => {
  it('lowercases and strips dashes', () => {
    const code = generateRecoveryCode()
    expect(normalizeRecoveryCode(code)).toBe(code.replace(/-/g, ''))
  })

  it('strips spaces and any other stray characters from a bad paste', () => {
    expect(normalizeRecoveryCode('k4m2p r9xtq_3wbnf.h7dje')).toBe('k4m2pr9xtq3wbnfh7dje')
  })

  it('is case-insensitive', () => {
    expect(normalizeRecoveryCode('K4M2P-R9XTQ')).toBe(normalizeRecoveryCode('k4m2p-r9xtq'))
  })

  it('is idempotent', () => {
    const once = normalizeRecoveryCode('K4M2P-R9XTQ')
    expect(normalizeRecoveryCode(once)).toBe(once)
  })
})

describe('recovery code hash round-trip (through password.ts, as authStore actually uses it)', () => {
  it('verifies a code typed back with different formatting than it was hashed with', async () => {
    const code = generateRecoveryCode()
    const hash = await hashPassword(normalizeRecoveryCode(code))

    // What ForgotPasswordForm actually does: the user retypes it without
    // dashes and in capitals.
    const retyped = code.toUpperCase().replace(/-/g, ' ')
    expect(await verifyPassword(normalizeRecoveryCode(retyped), hash)).toBe(true)
  })

  it('rejects a wrong code', async () => {
    const hash = await hashPassword(normalizeRecoveryCode(generateRecoveryCode()))
    expect(await verifyPassword(normalizeRecoveryCode(generateRecoveryCode()), hash)).toBe(false)
  })
})
