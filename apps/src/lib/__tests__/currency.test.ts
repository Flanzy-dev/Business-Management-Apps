import { describe, it, expect } from 'vitest'
import { formatCurrency, formatCompactIDR } from '../format/numbers'

describe('formatCurrency', () => {
  it('formats as Indonesian Rupiah with no decimal places', () => {
    expect(formatCurrency(1500000)).toBe('Rp 1.500.000')
  })

  it('rounds to a whole Rupiah — there is no minor unit in practice', () => {
    expect(formatCurrency(0)).toBe('Rp 0')
  })
})

describe('formatCompactIDR', () => {
  it('abbreviates billions as M (miliar)', () => {
    expect(formatCompactIDR(2_400_000_000)).toBe('Rp 2,4 M')
  })

  it('abbreviates millions as jt (juta)', () => {
    expect(formatCompactIDR(1_200_000)).toBe('Rp 1,2 jt')
  })

  it('abbreviates thousands as rb (ribu)', () => {
    expect(formatCompactIDR(850_000)).toBe('Rp 850 rb')
  })

  it('leaves sub-thousand amounts unabbreviated', () => {
    expect(formatCompactIDR(500)).toBe('Rp 500')
  })

  it('keeps the sign on a negative amount without doubling it into the abbreviated figure', () => {
    expect(formatCompactIDR(-2_400_000_000)).toBe('-Rp 2,4 M')
  })

  it('is exact at the tier boundary — one rupiah under 1 miliar still reads as jt', () => {
    expect(formatCompactIDR(999_999_999)).toBe('Rp 1.000 jt')
    expect(formatCompactIDR(1_000_000_000)).toBe('Rp 1 M')
  })
})
