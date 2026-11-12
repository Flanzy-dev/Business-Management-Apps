import { describe, it, expect } from 'vitest'
import { purchaseAmount, newAverageCostAfterPurchase, restockPurchase, supplierNameById } from '../inventory/restockForm'
import type { Supplier } from '../../store/supplierStore'

describe('purchaseAmount', () => {
  it('uses qty * costPrice when the cost field has not been hand-edited', () => {
    expect(purchaseAmount(5, false, '999999', 10_000)).toBe(50_000)
  })

  it('multiplies the typed cost PER ITEM by the quantity once the field has been hand-edited', () => {
    // 5 items at Rp 9.000 each — the cashier types 9000, not 45000.
    expect(purchaseAmount(5, true, '9000', 10_000)).toBe(45_000)
  })

  it('handles fractional litres', () => {
    expect(purchaseAmount(2.5, true, '40000', 10_000)).toBe(100_000)
  })

  it('rounds the total to whole Rupiah', () => {
    expect(purchaseAmount(3, true, '3333.5', 10_000)).toBe(10_001)
  })

  it('falls back to 0 on an unparseable typed override', () => {
    expect(purchaseAmount(5, true, 'abc', 10_000)).toBe(0)
    expect(purchaseAmount(5, true, '', 10_000)).toBe(0)
  })
})

describe('newAverageCostAfterPurchase', () => {
  it('blends the new purchase into the existing on-hand value', () => {
    // 10 on hand at 10,000 (=100,000) + 5 arriving for 45,000 -> 145,000 / 15
    expect(newAverageCostAfterPurchase(10, 10_000, 5, 45_000)).toBe(Math.round(145_000 / 15))
  })

  it('is 0 when there is no stock left after the adjustment', () => {
    expect(newAverageCostAfterPurchase(0, 10_000, 0, 0)).toBe(0)
  })
})

describe('restockPurchase', () => {
  it('is null for a subtraction, regardless of the expense toggle', () => {
    expect(restockPurchase('subtract', true, 5, false, '', 10_000, 'Acme', 'Oil')).toBeNull()
  })

  it('is null when the shop opted out of recording an expense', () => {
    expect(restockPurchase('add', false, 5, false, '', 10_000, 'Acme', 'Oil')).toBeNull()
  })

  it('builds the purchase for an expensed arrival', () => {
    expect(restockPurchase('add', true, 5, false, '', 10_000, 'Acme', 'Oil')).toEqual({
      amount: 50_000,
      vendor: 'Acme',
      description: 'Oil',
    })
  })

  it('respects a hand-edited cost per item, recording the total', () => {
    expect(restockPurchase('add', true, 5, true, '9000', 10_000, 'Acme', 'Oil')?.amount).toBe(45_000)
  })

  it('records exactly the total the dialog shows', () => {
    expect(restockPurchase('add', true, 4, true, '12500', 10_000, 'Acme', 'Oil')?.amount).toBe(purchaseAmount(4, true, '12500', 10_000))
  })
})

function supplier(overrides: Partial<Supplier> = {}): Supplier {
  return { id: 's-1', name: 'Acme', phone: '', email: '', address: '', notes: '', createdAt: '', ...overrides }
}

describe('supplierNameById', () => {
  it('is blank with no supplier on file', () => {
    expect(supplierNameById([], null)).toBe('')
  })

  it('is blank when the id no longer matches a supplier', () => {
    expect(supplierNameById([supplier({ id: 's-1' })], 's-gone')).toBe('')
  })

  it('finds the matching supplier by id', () => {
    expect(supplierNameById([supplier({ id: 's-1', name: 'Acme' })], 's-1')).toBe('Acme')
  })
})
