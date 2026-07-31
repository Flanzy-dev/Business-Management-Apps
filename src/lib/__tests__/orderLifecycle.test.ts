import { describe, it, expect } from 'vitest'
import type { WorkOrder, WorkOrderItem } from '../../store/workOrderStore'
import { applyCompletion, deletionStockRestorations } from '../orderLifecycle'

let nextId = 1

function item(overrides: Partial<WorkOrderItem> = {}): WorkOrderItem {
  return {
    id: `item-${nextId++}`,
    description: 'Line item',
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
    mileageIn: null,
    date: '2026-06-15',
    items: [item()],
    subtotal: 0,
    discountPercent: 0,
    discountAmount: 0,
    taxPercent: 0,
    taxAmount: 0,
    total: 0,
    paymentMethod: 'pending',
    status: 'open',
    notes: '',
    createdAt: new Date(2026, 5, 15, 9, 0).toISOString(),
    completedAt: null,
    ...overrides,
  }
}

describe('applyCompletion', () => {
  it('completes an open order and stamps payment method + completedAt', () => {
    const now = new Date(2026, 6, 1, 14, 30)
    const result = applyCompletion(order(), 'cash', now)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.order.status).toBe('completed')
    expect(result.order.paymentMethod).toBe('cash')
    expect(result.order.completedAt).toBe(now.toISOString())
  })

  it('deducts stock only for product-linked lines', () => {
    const result = applyCompletion(
      order({
        items: [
          item({ productId: 'oil-5w30', quantity: 4 }),
          item({ productId: null }), // manual labor line — no stock effect
        ],
      }),
      'card'
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.stockAdjustments).toEqual([{ productId: 'oil-5w30', delta: -4 }])
  })

  it('merges duplicate product lines into one net deduction', () => {
    const result = applyCompletion(
      order({
        items: [
          item({ productId: 'oil-5w30', quantity: 3 }),
          item({ productId: 'oil-5w30', quantity: 1 }),
          item({ productId: 'filter-a', quantity: 1 }),
        ],
      }),
      'cash'
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.stockAdjustments).toEqual([
      { productId: 'oil-5w30', delta: -4 },
      { productId: 'filter-a', delta: -1 },
    ])
  })

  it('rejects completing an already-completed order (would double-deduct)', () => {
    const result = applyCompletion(order({ status: 'completed' }), 'cash')
    expect(result.ok).toBe(false)
  })

  it('rejects completing a cancelled order', () => {
    const result = applyCompletion(order({ status: 'cancelled' }), 'cash')
    expect(result.ok).toBe(false)
  })

  it('rejects completing an order with no items', () => {
    const result = applyCompletion(order({ items: [] }), 'cash')
    expect(result.ok).toBe(false)
  })
})

describe('deletionStockRestorations', () => {
  const items = [
    item({ productId: 'oil-5w30', quantity: 4 }),
    item({ productId: null, quantity: 2 }),
  ]

  it('restores consumed stock when deleting a completed order', () => {
    expect(deletionStockRestorations(order({ status: 'completed', items }))).toEqual([
      { productId: 'oil-5w30', delta: 4 },
    ])
  })

  it('restores nothing for open or cancelled orders (stock was never deducted)', () => {
    expect(deletionStockRestorations(order({ status: 'open', items }))).toEqual([])
    expect(deletionStockRestorations(order({ status: 'cancelled', items }))).toEqual([])
  })
})
