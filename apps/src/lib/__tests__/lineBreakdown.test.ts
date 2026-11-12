import { describe, expect, it } from 'vitest'
import { lineBreakdown } from '../orders/lineBreakdown'

// Intl puts a non-breaking space after "Rp"; compare with an ordinary one.
const plain = (s: string | null) => s?.replace(/ /g, ' ') ?? null

describe('lineBreakdown', () => {
  it('shows the unit price times the quantity', () => {
    expect(plain(lineBreakdown({ quantity: 2, unitPrice: 110_000 }))).toBe('2 × Rp 110.000')
  })

  it('writes a fractional litre the Indonesian way', () => {
    expect(plain(lineBreakdown({ quantity: 1.5, unitPrice: 100_000 }))).toBe('1,5 × Rp 100.000')
  })

  it('says nothing for a single unit — the total beside it already is the price', () => {
    expect(lineBreakdown({ quantity: 1, unitPrice: 50_000 })).toBeNull()
  })
})
