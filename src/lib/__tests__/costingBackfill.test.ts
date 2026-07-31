import { describe, it, expect } from 'vitest'
import type { WorkOrder, WorkOrderItem } from '../../store/workOrderStore'
import { freezeHistoricalCosts } from '../costingBackfill'

let nextId = 1

function item(overrides: Partial<WorkOrderItem> = {}): WorkOrderItem {
  return {
    id: `item-${nextId++}`,
    description: 'Line',
    quantity: 1,
    unitPrice: 0,
    lineTotal: 0,
    productId: null,
    ...overrides,
  }
}

function order(overrides: Partial<WorkOrder> = {}): WorkOrder {
  return {
    id: `wo-${nextId++}`,
    orderNumber: 1001,
    vehicleId: 'v-1',
    workerId: null,
    driverId: null,
    odometerAtArrival: null,
    odometerAtService: null,
    date: '2026-06-15',
    items: [],
    subtotal: 0,
    discountAmount: 0,
    taxPercent: 0,
    taxAmount: 0,
    total: 0,
    paymentMethod: 'cash',
    status: 'completed',
    notes: '',
    createdAt: '2026-06-15T09:00:00.000Z',
    completedAt: '2026-06-15T10:00:00.000Z',
    ...overrides,
  }
}

describe('freezeHistoricalCosts', () => {
  const costs = new Map([['p-1', 40_000]])

  it("stamps today's cost onto unpriced product lines of completed orders", () => {
    const o = order({ items: [item({ productId: 'p-1', quantity: 4 })] })
    const [frozen] = freezeHistoricalCosts([o], costs)
    expect(frozen.orderId).toBe(o.id)
    expect(frozen.items[0].costOfGoods).toBe(160_000)
  })

  it('leaves a line that already carries a cost alone', () => {
    const o = order({ items: [item({ productId: 'p-1', quantity: 4, costOfGoods: 350_000 })] })
    expect(freezeHistoricalCosts([o], costs)).toEqual([])
  })

  it('ignores labor lines and orders that were never completed', () => {
    const labor = order({ items: [item({ productId: null })] })
    const open = order({ status: 'open', items: [item({ productId: 'p-1' })] })
    expect(freezeHistoricalCosts([labor, open], costs)).toEqual([])
  })

  it('costs a deleted product at zero rather than dropping the line', () => {
    const o = order({ items: [item({ productId: 'gone', quantity: 2 })] })
    const [frozen] = freezeHistoricalCosts([o], costs)
    expect(frozen.items[0].costOfGoods).toBe(0)
  })
})
