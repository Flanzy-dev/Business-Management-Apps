// The ticket-editing rules that used to be untestable WorkOrderEditor.tsx
// handlers. The pure helpers they combine (remainingStock,
// findMatchingProductLine, …) each had tests; how they're combined didn't —
// and that combination is where the double-click bug lived.
import { describe, it, expect } from 'vitest'
import { createOrderLineOps } from '../ops/orderLineOps'
import { buildFakeOpsDeps } from './helpers/fakeOpsDeps'
import type { Product } from '../../store/inventoryStore'
import type { StockMovement } from '../../store/stockMovementStore'
import type { ServiceCatalogItem } from '../../store/serviceCatalogStore'
import type { LineItemDraft } from '../orders/lineItemForm'
import { order } from './helpers/vehicleFixtures'

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p-1', name: 'Meditran S-40 1L', sku: '', supplierCode: '', category: 'Aksesoris', unit: 'each',
    costPrice: 30_000, sellPrice: 38_000, reorderPoint: 0, supplierId: null, notes: '',
    createdAt: '2026-01-01T00:00:00.000Z', ...overrides,
  }
}

function stock(productId: string, qty: number): StockMovement {
  return {
    id: `m-${productId}`, productId, delta: qty, reason: 'purchase', lotId: null, unitCost: 30_000,
    refType: null, refId: null, occurredAt: '2026-01-01T00:00:00.000Z', deviceId: 'test',
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}

function shop(qtyOnHand: number) {
  const world = buildFakeOpsDeps({
    products: [product()],
    movements: [stock('p-1', qtyOnHand)],
    workOrders: [order({ id: 'o-1', status: 'open', items: [] })],
  })
  return { world, ops: createOrderLineOps(world.deps), lines: () => world.workOrders.workOrders[0].items }
}

const draft = (overrides: Partial<LineItemDraft> = {}): LineItemDraft => ({
  description: 'Meditran S-40 1L', quantity: 1, unitPrice: 38_000, kind: 'product', serviceItemTypeId: null,
  quantityLiters: null, serviceAction: null, containerType: null, requestedIntervalKm: null, ...overrides,
})

describe('addProductToOrder', () => {
  it('two taps in a row make one line of 2, not two lines (the double-click case)', () => {
    const { ops, lines } = shop(5)
    ops.addProductToOrder('o-1', 'p-1')
    ops.addProductToOrder('o-1', 'p-1')
    expect(lines()).toHaveLength(1)
    expect(lines()[0]).toMatchObject({ productId: 'p-1', quantity: 2, lineTotal: 76_000 })
  })

  it('refuses once this order already holds everything on the shelf', () => {
    const { ops, lines } = shop(1)
    expect(ops.addProductToOrder('o-1', 'p-1')).toEqual({ ok: true })
    expect(ops.addProductToOrder('o-1', 'p-1')).toMatchObject({ ok: false, reason: 'outOfStock' })
    expect(lines()[0].quantity).toBe(1)
  })
})

describe('addServiceToOrder', () => {
  const service = { id: 's-1', name: 'Jasa Ganti Oli', price: 25_000 } as ServiceCatalogItem

  it('bumps the matching line instead of stacking, with no stock guard', () => {
    const { ops, lines } = shop(0)
    ops.addServiceToOrder('o-1', service)
    ops.addServiceToOrder('o-1', service)
    expect(lines()).toHaveLength(1)
    expect(lines()[0].quantity).toBe(2)
  })
})

describe('changeLineQuantity', () => {
  it('removes the line at zero', () => {
    const { ops, lines } = shop(5)
    ops.addProductToOrder('o-1', 'p-1')
    ops.changeLineQuantity('o-1', lines()[0].id, -1)
    expect(lines()).toEqual([])
  })

  it('refuses to grow a product line past the shelf, and says how many are free', () => {
    const { ops, lines } = shop(1)
    ops.addProductToOrder('o-1', 'p-1')
    expect(ops.changeLineQuantity('o-1', lines()[0].id, 1)).toMatchObject({ ok: false, reason: 'insufficientStock', available: 0 })
    expect(lines()[0].quantity).toBe(1)
  })
})

describe('saveLine', () => {
  it('adds a custom line, never linked to a product', () => {
    const { ops, lines } = shop(0)
    ops.saveLine('o-1', null, draft({ description: 'Baut', quantity: 2, unitPrice: 15_000, kind: 'product' }))
    expect(lines()).toMatchObject([{ description: 'Baut', productId: null, lineTotal: 30_000 }])
  })

  it('lets a product line grow to what is free plus what it already holds, and no further', () => {
    const { ops, lines } = shop(3)
    ops.addProductToOrder('o-1', 'p-1') // holds 1, 2 still free → may grow to 3
    const id = lines()[0].id
    expect(ops.saveLine('o-1', id, draft({ quantity: 4 }))).toMatchObject({ ok: false, reason: 'insufficientStock', available: 3 })
    expect(ops.saveLine('o-1', id, draft({ quantity: 3 }))).toEqual({ ok: true })
    expect(lines()[0].quantity).toBe(3)
  })
})

describe('removeLine / restoreLine', () => {
  it('hands back the removed line, and Undo puts it back', () => {
    const { ops, lines } = shop(5)
    ops.addProductToOrder('o-1', 'p-1')
    ops.addProductToOrder('o-1', 'p-1')
    const removed = ops.removeLine('o-1', lines()[0].id)
    expect(removed).toMatchObject({ productId: 'p-1', quantity: 2 })
    expect(lines()).toHaveLength(0)
    expect(ops.restoreLine('o-1', removed!)).toEqual({ ok: true })
    expect(lines()).toHaveLength(1)
    expect(lines()[0]).toMatchObject({ productId: 'p-1', quantity: 2, lineTotal: 76_000 })
  })

  it('returns null for a line that is already gone', () => {
    const { ops } = shop(5)
    expect(ops.removeLine('o-1', 'nope')).toBeNull()
  })

  it('refuses Undo when the stock was used up in the meantime', () => {
    const { ops, lines } = shop(2)
    ops.addProductToOrder('o-1', 'p-1')
    ops.addProductToOrder('o-1', 'p-1')
    const removed = ops.removeLine('o-1', lines()[0].id)!
    ops.addProductToOrder('o-1', 'p-1')
    expect(ops.restoreLine('o-1', removed)).toMatchObject({ ok: false, reason: 'insufficientStock', available: 1 })
    expect(lines()).toHaveLength(1)
  })
})
