import { describe, expect, it } from 'vitest'
import { allocateCost, recordedStockForOrder } from '../orders/orderLedger'
import type { StockMovement } from '../../store/stockMovementStore'

function movement(overrides: Partial<StockMovement>): StockMovement {
  return {
    id: `m-${Math.random()}`,
    productId: 'p-1',
    delta: -1,
    reason: 'sale',
    lotId: 'lot-1',
    unitCost: 50_000,
    refType: 'workOrder',
    refId: 'wo-1',
    occurredAt: '2026-08-10T09:00:00.000Z',
    deviceId: 'd-1',
    createdAt: '2026-08-10T09:00:00.000Z',
    ...overrides,
  }
}

describe('recordedStockForOrder', () => {
  it('knows nothing of an order the ledger has never seen', () => {
    expect(recordedStockForOrder([movement({ refId: 'other' })], 'wo-1').size).toBe(0)
  })

  it('adds up what a sale took out and what it cost', () => {
    const ledger = [
      movement({ delta: -2, unitCost: 50_000 }),
      movement({ delta: -1, unitCost: 70_000, lotId: null }),
    ]
    expect(recordedStockForOrder(ledger, 'wo-1').get('p-1')).toEqual({
      netOut: 3,
      soldQty: 3,
      soldCost: 170_000,
    })
  })

  it('counts a reversal as stock put back, leaving nothing out', () => {
    const ledger = [movement({ delta: -2 }), movement({ delta: 2, reason: 'sale-reversal' })]
    const recorded = recordedStockForOrder(ledger, 'wo-1').get('p-1')!
    expect(recorded.netOut).toBe(0)
    // The sale itself still happened, and is what a later restore would price from.
    expect(recorded.soldQty).toBe(2)
  })

  it('keeps products apart and ignores other orders and non-order movements', () => {
    const ledger = [
      movement({ productId: 'p-1', delta: -1 }),
      movement({ productId: 'p-2', delta: -4 }),
      movement({ productId: 'p-1', delta: -9, refId: 'wo-2' }),
      movement({ productId: 'p-1', delta: 50, refType: 'expense', refId: 'wo-1', reason: 'purchase' }),
    ]
    const recorded = recordedStockForOrder(ledger, 'wo-1')
    expect(recorded.get('p-1')?.netOut).toBe(1)
    expect(recorded.get('p-2')?.netOut).toBe(4)
  })

  it('rounds fractional litres instead of leaving float noise', () => {
    const ledger = [movement({ delta: -2.2 }), movement({ delta: 2.2, reason: 'sale-reversal' }), movement({ delta: -0.1 }), movement({ delta: -0.2 })]
    expect(recordedStockForOrder(ledger, 'wo-1').get('p-1')?.netOut).toBe(0.3)
  })
})

describe('allocateCost', () => {
  it('splits in proportion to quantity', () => {
    expect(allocateCost(300_000, [1, 2])).toEqual([100_000, 200_000])
  })

  it('always sums back to the total, whatever the rounding', () => {
    const parts = allocateCost(100_001, [1, 1, 1])
    expect(parts.reduce((a, b) => a + b, 0)).toBe(100_001)
  })

  it('gives every line 0 when there is no quantity to split by', () => {
    expect(allocateCost(5_000, [0, 0])).toEqual([0, 0])
  })

  it('hands a single line the whole amount', () => {
    expect(allocateCost(123_456, [3])).toEqual([123_456])
  })
})
