import { describe, it, expect } from 'vitest'
import { decodeModelYear, decodeVin } from '../vinDecode'

/** A syntactically-17-char VIN with only position 7 and position 10 controlled. */
function vinWith(pos7: string, pos10: string): string {
  const chars = Array(17).fill('0')
  chars[6] = pos7
  chars[9] = pos10
  return chars.join('')
}

describe('decodeModelYear', () => {
  it('reads the older cycle when position 7 is a digit', () => {
    expect(decodeModelYear(vinWith('1', 'M'))).toBe(1991)
  })

  it('reads the newer (+30) cycle when position 7 is a letter', () => {
    expect(decodeModelYear(vinWith('A', 'M'))).toBe(2021)
  })

  it('returns null for a year code that is never used (I/O/Q/U/Z/0)', () => {
    expect(decodeModelYear(vinWith('1', '0'))).toBeNull()
  })

  it('returns null for anything not exactly 17 characters', () => {
    expect(decodeModelYear('SHORT')).toBeNull()
    expect(decodeModelYear('')).toBeNull()
  })
})

describe('decodeVin', () => {
  it('resolves manufacturer and country for a WMI in the table', () => {
    // The exact VIN already used as this app's own VIN-field placeholder.
    expect(decodeVin('1HGBH41JXMN109186')).toEqual({
      wmi: '1HG',
      manufacturer: 'Honda',
      country: 'United States',
      modelYear: 1991,
    })
  })

  it('falls back to country-only when the WMI is only in the region table', () => {
    const result = decodeVin('SXX'.padEnd(17, '0'))
    expect(result.wmi).toBe('SXX')
    expect(result.manufacturer).toBeNull()
    expect(result.country).toBe('United Kingdom')
  })

  it('returns both null when the prefix matches neither table — honest "unknown", not a guess', () => {
    const result = decodeVin('MA'.padEnd(17, 'B'))
    expect(result.manufacturer).toBeNull()
    expect(result.country).toBeNull()
  })

  it('decodes nothing for a VIN that is not exactly 17 characters, without throwing', () => {
    expect(decodeVin('SHORT')).toEqual({ wmi: '', manufacturer: null, country: null, modelYear: null })
    expect(decodeVin('')).toEqual({ wmi: '', manufacturer: null, country: null, modelYear: null })
  })
})
