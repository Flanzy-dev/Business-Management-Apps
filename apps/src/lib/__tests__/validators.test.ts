import { describe, it, expect } from 'vitest'
import { formatVIN, formatLicensePlate } from '../format/validators'

describe('formatVIN', () => {
  it('uppercases as the user types', () => {
    expect(formatVIN('1hgcm82633a')).toBe('1HGCM82633A')
  })

  it('strips the characters a VIN can never contain (I, O, Q)', () => {
    expect(formatVIN('1HGIOQ82633A')).toBe('1HG82633A')
  })

  it('strips any other non-VIN character, e.g. from a pasted value with spaces or dashes', () => {
    expect(formatVIN('1HG-CM82 633A')).toBe('1HGCM82633A')
  })

  it('truncates to 17 characters', () => {
    expect(formatVIN('1HGCM82633A123456789')).toHaveLength(17)
    expect(formatVIN('1HGCM82633A123456789')).toBe('1HGCM82633A123456')
  })
})

describe('formatLicensePlate', () => {
  it('uppercases as the user types', () => {
    expect(formatLicensePlate('b 1234 xyz')).toBe('B 1234 XYZ')
  })

  it('keeps spaces and hyphens — both appear in real Indonesian plates', () => {
    expect(formatLicensePlate('b-1234-xyz')).toBe('B-1234-XYZ')
  })

  it('strips characters outside the allowed alphanumeric/space/hyphen set', () => {
    expect(formatLicensePlate('B 1234 XYZ!@#')).toBe('B 1234 XYZ')
  })

  it('truncates to 11 characters', () => {
    expect(formatLicensePlate('B1234XYZEXTRA')).toBe('B1234XYZEXT')
    expect(formatLicensePlate('B1234XYZEXTRA')).toHaveLength(11)
  })
})
