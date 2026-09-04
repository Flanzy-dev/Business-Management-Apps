import { describe, it, expect } from 'vitest'
import { purchaseAmount, newAverageCostAfterPurchase, restockPurchase, supplierNameById } from '../restockForm'
import type { Supplier } from '../../store/supplierStore'

describe('purchaseAmount', () => {
  it('uses qty * costPrice when the cost field has not been hand-edited', () => {
    expect(purchaseAmount(5, false, '999999', 10_000)).toBe(50_000)
  })

  it('uses the typed override once the cost field has been hand-edited', () => {
    expect(purchaseAmount(5, true, '45000', 10_000)).toBe(45_000)
  })

  it('falls back to 0 on an unparseable typed override', () => {
    expect(purchaseAmount(5, true, 'abc', 10_000)).toBe(0)
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

  it('respects a hand-edited cost override', () => {
    expect(restockPurchase('add', true, 5, true, '45000', 10_000, 'Acme', 'Oil')?.amount).toBe(45_000)
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
