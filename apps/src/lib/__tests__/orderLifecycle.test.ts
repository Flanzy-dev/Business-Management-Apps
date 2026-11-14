import { describe, it, expect } from 'vitest'
import type { WorkOrder, WorkOrderItem } from '../../store/workOrderStore'
import { applyCompletion, applyDueDateExtension, applyPayment, applyVehicleChange, applyVoid, deletionStockRestorations, firstInsufficientStockProduct, remainingStock } from '../orders/orderLifecycle'

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
    const result = applyCompletion(order(), 'cash', null, now)
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

  it('carries the due date onto the order when paying pending', () => {
    const result = applyCompletion(order(), 'pending', '2026-07-15')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.order.paymentDueDate).toBe('2026-07-15')
  })

  it('never stamps a due date on a non-pending method, even if one is passed in', () => {
    const result = applyCompletion(order(), 'cash', '2026-07-15')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.order.paymentDueDate).toBeNull()
  })
})

describe('applyPayment', () => {
  const now = new Date(2026, 6, 20, 9, 0)

  it('collects a pending completed order and stamps paidAt', () => {
    const pendingOrder = order({ status: 'completed', paymentMethod: 'pending', total: 150_000 })
    const result = applyPayment(pendingOrder, 'cash', 150_000, now)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.order.paymentMethod).toBe('cash')
    expect(result.order.amountReceived).toBe(150_000)
    expect(result.order.paidAt).toBe(now.toISOString())
  })

  it('rejects an order that never completed', () => {
    const result = applyPayment(order({ status: 'open', paymentMethod: 'pending' }), 'cash', null, now)
    expect(result.ok).toBe(false)
  })

  it('rejects an order that is not currently pending (guards double-collection)', () => {
    const result = applyPayment(order({ status: 'completed', paymentMethod: 'cash' }), 'card', null, now)
    expect(result.ok).toBe(false)
  })

  it('rejects settling as "pending" itself', () => {
    const result = applyPayment(order({ status: 'completed', paymentMethod: 'pending' }), 'pending', null, now)
    expect(result.ok).toBe(false)
  })
})

describe('applyDueDateExtension', () => {
  // Wed 12 Aug 2026, mid-day local — a due date is a calendar day, so the
  // comparison must not wobble with the time of day or the timezone.
  const now = new Date(2026, 7, 12, 14, 30)
  const unpaid = (overrides: Partial<WorkOrder> = {}) =>
    order({ status: 'completed', paymentMethod: 'pending', paymentDueDate: '2026-08-14', ...overrides })

  it('moves the due date of an unpaid, completed order later', () => {
    const result = applyDueDateExtension(unpaid(), '2026-08-28', now)
    expect(result).toEqual({ ok: true, patch: { paymentDueDate: '2026-08-28' } })
  })

  it('touches nothing but the due date', () => {
    const result = applyDueDateExtension(unpaid(), '2026-08-28', now)
    expect(result.ok && Object.keys(result.patch)).toEqual(['paymentDueDate'])
  })

  it('extends an invoice that is already overdue, as long as the new date is still ahead', () => {
    const result = applyDueDateExtension(unpaid({ paymentDueDate: '2026-08-01' }), '2026-08-19', now)
    expect(result.ok).toBe(true)
  })

  it('gives a due date to an invoice that never had one', () => {
    expect(applyDueDateExtension(unpaid({ paymentDueDate: null }), '2026-08-20', now).ok).toBe(true)
    expect(applyDueDateExtension(unpaid({ paymentDueDate: undefined }), '2026-08-20', now).ok).toBe(true)
  })

  it('accepts today — a promise to pay by the end of the day is still an extension', () => {
    expect(applyDueDateExtension(unpaid({ paymentDueDate: '2026-08-01' }), '2026-08-12', now).ok).toBe(true)
  })

  it('refuses a day that has already gone', () => {
    expect(applyDueDateExtension(unpaid({ paymentDueDate: null }), '2026-08-11', now).ok).toBe(false)
  })

  it('refuses to pull the date earlier, or to keep it where it is — that is not an extension', () => {
    expect(applyDueDateExtension(unpaid(), '2026-08-13', now).ok).toBe(false)
    expect(applyDueDateExtension(unpaid(), '2026-08-14', now).ok).toBe(false)
  })

  it('refuses text that is not a real calendar day', () => {
    for (const bad of ['', 'soon', '2026-8-20', '20-08-2026', '2026-02-31', '2026-13-01']) {
      expect(applyDueDateExtension(unpaid(), bad, now).ok).toBe(false)
    }
  })

  it('refuses an order that is not an unpaid invoice', () => {
    expect(applyDueDateExtension(unpaid({ paymentMethod: 'cash' }), '2026-08-28', now).ok).toBe(false)
    expect(applyDueDateExtension(unpaid({ status: 'open' }), '2026-08-28', now).ok).toBe(false)
    expect(applyDueDateExtension(unpaid({ status: 'cancelled' }), '2026-08-28', now).ok).toBe(false)
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

describe('applyVoid', () => {
  const now = new Date(2026, 5, 20, 10, 0)

  it('rejects an order that was never completed', () => {
    expect(applyVoid(order({ status: 'open' }), 'oops', now).ok).toBe(false)
    expect(applyVoid(order({ status: 'cancelled' }), 'oops', now).ok).toBe(false)
  })

  it('cancels a completed order, records the reason, and returns its stock restorations', () => {
    const items = [item({ productId: 'oil-5w30', quantity: 3 }), item({ productId: null, quantity: 1 })]
    const result = applyVoid(order({ status: 'completed', items }), 'wrong vehicle', now)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.order.status).toBe('cancelled')
    expect(result.order.voidReason).toBe('wrong vehicle')
    expect(result.order.voidedAt).toBe(now.toISOString())
    expect(result.stockRestorations).toEqual([{ productId: 'oil-5w30', delta: 3 }])
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

describe('applyVehicleChange', () => {
  it('moves an open order to the new vehicle and restarts its odometer from that car', () => {
    const result = applyVehicleChange(
      order({ odometerAtArrival: 50_000, odometerAtService: 50_010 }),
      { companyId: null },
      { id: 'v-2', currentMileage: 81_000 }
    )
    expect(result).toEqual({
      ok: true,
      patch: { vehicleId: 'v-2', driverId: null, odometerAtArrival: 81_000, odometerAtService: null },
    })
  })

  it('keeps the fleet driver when both vehicles belong to the same company', () => {
    const result = applyVehicleChange(order({ driverId: 'd-1' }), { companyId: 'co-1' }, { id: 'v-2', companyId: 'co-1' })
    expect(result.ok && result.patch.driverId).toBe('d-1')
  })

  it('drops the driver when the new vehicle is someone else\'s', () => {
    const result = applyVehicleChange(order({ driverId: 'd-1' }), { companyId: 'co-1' }, { id: 'v-2', companyId: 'co-2' })
    expect(result.ok && result.patch.driverId).toBeNull()
  })

  it('refuses a completed order — its stock and schedule effects already happened', () => {
    expect(applyVehicleChange(order({ status: 'completed' }), undefined, { id: 'v-2' }).ok).toBe(false)
  })
})
