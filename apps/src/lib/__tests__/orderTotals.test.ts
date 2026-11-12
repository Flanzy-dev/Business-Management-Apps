import { describe, it, expect } from 'vitest'
import { lineTotal, computeOrderTotals } from '../orders/orderTotals'

describe('lineTotal', () => {
  it('rounds fractional litres to whole Rupiah', () => {
    expect(lineTotal(8.5, 42_000)).toBe(357_000)
    expect(lineTotal(1.25, 33_333)).toBe(41_666)
  })
})

describe('computeOrderTotals', () => {
  const lines = [{ lineTotal: 450_000 }, { lineTotal: 115_000 }]

  it('sums the lines, applies the discount, then tax on what is left', () => {
    expect(computeOrderTotals(lines, 65_000, 11)).toEqual({
      subtotal: 565_000, discountAmount: 65_000, taxAmount: 55_000, total: 555_000,
    })
  })

  it('clamps a discount to the subtotal and never below zero', () => {
    expect(computeOrderTotals(lines, 999_999, 0)).toMatchObject({ discountAmount: 565_000, total: 0 })
    expect(computeOrderTotals(lines, -5, 0)).toMatchObject({ discountAmount: 0, total: 565_000 })
  })

  it('is all zero for an empty order', () => {
    expect(computeOrderTotals([], 10_000, 11)).toEqual({ subtotal: 0, discountAmount: 0, taxAmount: 0, total: 0 })
  })
})
