import { describe, it, expect } from 'vitest'
import type { WorkOrder, WorkOrderItem } from '../../store/workOrderStore'
import { applyCompletion, deletionStockRestorations, firstInsufficientStockProduct, remainingStock } from '../orderLifecycle'

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
    odometerAtArrival: null,
    odometerAtService: null,
    date: '2026-06-15',
    items: [item()],
    subtotal: 0,
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

describe('remainingStock', () => {
  const product = { id: 'oil-5w30', qtyOnHand: 10 }

  it('is the full stock when the order has no lines for that product', () => {
    expect(remainingStock([], product)).toBe(10)
    expect(remainingStock([item({ productId: 'filter-a', quantity: 3 })], product)).toBe(10)
  })

  it('subtracts quantity already reserved by a line', () => {
    expect(remainingStock([item({ productId: 'oil-5w30', quantity: 4 })], product)).toBe(6)
  })

  it('subtracts across every line of the same product', () => {
    const items = [
      item({ productId: 'oil-5w30', quantity: 4 }),
      item({ productId: 'oil-5w30', quantity: 3 }),
      item({ productId: null, quantity: 2 }),
    ]
    expect(remainingStock(items, product)).toBe(3)
  })

  it('goes negative when the order already over-reserves (caller decides how to react)', () => {
    expect(remainingStock([item({ productId: 'oil-5w30', quantity: 12 })], product)).toBe(-2)
  })
})

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

describe('firstInsufficientStockProduct', () => {
  it('returns null when every deduction is covered by current stock', () => {
    const stock = new Map([['oil-5w30', 4], ['filter-a', 1]])
    const adjustments = [
      { productId: 'oil-5w30', delta: -4 },
      { productId: 'filter-a', delta: -1 },
    ]
    expect(firstInsufficientStockProduct(adjustments, (id) => stock.get(id))).toBeNull()
  })

  it('flags a product whose merged demand exceeds stock (the two-lines-same-product oversell)', () => {
    // e.g. two order lines of 4 each against 5 in stock — merged to -8 by
    // stockDeltas, which a per-line UI guard checking against raw qtyOnHand
    // would not catch on its own.
    const stock = new Map([['oil-5w30', 5]])
    const adjustments = [{ productId: 'oil-5w30', delta: -8 }]
    expect(firstInsufficientStockProduct(adjustments, (id) => stock.get(id))).toBe('oil-5w30')
  })

  it('never rejects stock restorations (positive deltas)', () => {
    const stock = new Map([['oil-5w30', 0]])
    const adjustments = [{ productId: 'oil-5w30', delta: 4 }]
    expect(firstInsufficientStockProduct(adjustments, (id) => stock.get(id))).toBeNull()
  })

  it('does not reject when stock is unknown to the caller (defensive: only checks what it can)', () => {
    const adjustments = [{ productId: 'missing-product', delta: -1 }]
    expect(firstInsufficientStockProduct(adjustments, () => undefined)).toBeNull()
  })
})
