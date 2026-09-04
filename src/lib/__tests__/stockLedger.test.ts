import { describe, it, expect } from 'vitest'
import type { Product } from '../../store/inventoryStore'
import type { StockLot } from '../../store/stockLotStore'
import type { StockMovement } from '../../store/stockMovementStore'
import { qtyOnHand, qtyByProduct, withStock, hydrateLots, isLowStock, lowStockProducts, negativeStockProducts, manualStockChanges } from '../stockLedger'

let nextId = 1

function movement(overrides: Partial<StockMovement> = {}): StockMovement {
  return {
    id: `m-${nextId++}`,
    productId: 'p-1',
    delta: 0,
    reason: 'adjustment',
    lotId: null,
    unitCost: 0,
    refType: null,
    refId: null,
    occurredAt: '2026-01-10T00:00:00.000Z',
    deviceId: 'device-a',
    createdAt: '2026-01-10T00:00:00.000Z',
    ...overrides,
  }
}

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: `p-${nextId++}`,
    name: 'Product',
    sku: '',
    supplierCode: '',
    category: 'Oil',
    unit: 'each',
    costPrice: 0,
    sellPrice: 0,
    reorderPoint: 0,
    supplierId: null,
    notes: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function lot(overrides: Partial<StockLot> = {}): StockLot {
  return {
    id: `lot-${nextId++}`,
    productId: 'p-1',
    unitCost: 40_000,
    qtyReceived: 10,
    receivedAt: '2026-01-10T00:00:00.000Z',
    expenseId: null,
    createdAt: '2026-01-10T00:00:00.000Z',
    ...overrides,
  }
}

describe('qtyOnHand / qtyByProduct', () => {
  it('sums deltas for one product', () => {
    const movements = [
      movement({ productId: 'p-1', delta: 10 }),
      movement({ productId: 'p-1', delta: -3 }),
      movement({ productId: 'p-2', delta: 5 }),
    ]
    expect(qtyOnHand(movements, 'p-1')).toBe(7)
    expect(qtyOnHand(movements, 'p-2')).toBe(5)
    expect(qtyOnHand(movements, 'missing')).toBe(0)
  })

  it('does not clamp at zero — a real oversell stays visible', () => {
    const movements = [movement({ productId: 'p-1', delta: -5 })]
    expect(qtyOnHand(movements, 'p-1')).toBe(-5)
  })

  it('gives the same total regardless of the order movements were applied in', () => {
    // The property the whole offline story rests on: two devices merging
    // their movements in different orders must still agree on the total.
    const a = [movement({ delta: 10 }), movement({ delta: -4 }), movement({ delta: -2 })]
    const b = [a[2], a[0], a[1]]
    expect(qtyOnHand(a, 'p-1')).toBe(qtyOnHand(b, 'p-1'))
  })

  it('qtyByProduct matches qtyOnHand for every product in one pass', () => {
    const movements = [
      movement({ productId: 'p-1', delta: 6 }),
      movement({ productId: 'p-2', delta: -1 }),
    ]
    const totals = qtyByProduct(movements)
    expect(totals.get('p-1')).toBe(6)
    expect(totals.get('p-2')).toBe(-1)
  })
})

describe('withStock', () => {
  it('enriches each product with its derived quantity, defaulting to zero', () => {
    const p1 = product({ id: 'p-1' })
    const p2 = product({ id: 'p-2' })
    const movements = [movement({ productId: 'p-1', delta: 8 })]
    const result = withStock([p1, p2], movements)
    expect(result.find(p => p.id === 'p-1')?.qtyOnHand).toBe(8)
    expect(result.find(p => p.id === 'p-2')?.qtyOnHand).toBe(0)
  })
})

describe('hydrateLots', () => {
  it('sums movements referencing a lot into its remaining balance', () => {
    const l = lot({ id: 'lot-a', qtyReceived: 10 })
    const movements = [
      movement({ lotId: 'lot-a', delta: 10 }),
      movement({ lotId: 'lot-a', delta: -3 }),
    ]
    const [balance] = hydrateLots([l], movements)
    expect(balance.qtyRemaining).toBe(7)
  })

  it('gives a lot with no movements a zero balance rather than crashing', () => {
    const [balance] = hydrateLots([lot({ id: 'lot-a' })], [])
    expect(balance.qtyRemaining).toBe(0)
  })

  it('sorts oldest received first, the order drawFifo expects', () => {
    const older = lot({ id: 'old', receivedAt: '2026-01-01T00:00:00.000Z' })
    const newer = lot({ id: 'new', receivedAt: '2026-03-01T00:00:00.000Z' })
    const balances = hydrateLots([newer, older], [])
    expect(balances.map(b => b.id)).toEqual(['old', 'new'])
  })

  it('ignores movements for other lots or unattributed (lotId null) entries', () => {
    const l = lot({ id: 'lot-a', qtyReceived: 5 })
    const movements = [
      movement({ lotId: 'lot-a', delta: 5 }),
      movement({ lotId: 'lot-b', delta: 100 }),
      movement({ lotId: null, delta: -50 }),
    ]
    expect(hydrateLots([l], movements)[0].qtyRemaining).toBe(5)
  })
})

describe('lowStockProducts / negativeStockProducts', () => {
  it('flags products at or under their reorder point', () => {
    const low = product({ id: 'p-1', reorderPoint: 5 })
    const healthy = product({ id: 'p-2', reorderPoint: 5 })
    const movements = [
      movement({ productId: 'p-1', delta: 5 }),
      movement({ productId: 'p-2', delta: 20 }),
    ]
    const result = lowStockProducts([low, healthy], movements)
    expect(result.map(p => p.id)).toEqual(['p-1'])
  })

  it('leaves a product with no reorder point alone, even at zero stock', () => {
    // reorderPoint 0 means "not tracked" — the default for the hundreds of
    // catalog rows a price-list import creates. Without this, every one of
    // them would be crying out for a reorder it never needed.
    const untracked = product({ id: 'p-1', reorderPoint: 0 })
    const tracked = product({ id: 'p-2', reorderPoint: 1 })
    expect(lowStockProducts([untracked, tracked], []).map(p => p.id)).toEqual(['p-2'])
  })

  it('starts flagging an untracked product once it gets a reorder point', () => {
    const p = product({ id: 'p-1', reorderPoint: 3 })
    expect(isLowStock({ ...p, qtyOnHand: 0 })).toBe(true)
    expect(isLowStock({ ...p, reorderPoint: 0, qtyOnHand: 0 })).toBe(false)
  })

  it('still flags an oversold product that has a reorder point', () => {
    // Negative stock is below any positive reorder point — the guard is on
    // reorderPoint, never on qty.
    expect(isLowStock({ qtyOnHand: -2, reorderPoint: 5 })).toBe(true)
  })

  it('flags a product whose derived stock went negative — the oversell case', () => {
    const p = product({ id: 'p-1' })
    const movements = [movement({ productId: 'p-1', delta: -2 })]
    expect(negativeStockProducts([p], movements).map(x => x.id)).toEqual(['p-1'])
  })

  it('does not flag a product sitting exactly at zero as negative', () => {
    const p = product({ id: 'p-1' })
    expect(negativeStockProducts([p], [])).toEqual([])
  })
})

describe('manualStockChanges', () => {
  it('keeps received, purchase and adjustment — what Adjust/Receive Stock and Reconcile can produce', () => {
    const kept = [
      movement({ id: 'm-received', reason: 'received' }),
      movement({ id: 'm-purchase', reason: 'purchase' }),
      movement({ id: 'm-adjustment', reason: 'adjustment' }),
    ]
    expect(manualStockChanges(kept).map(m => m.id).sort()).toEqual(
      ['m-adjustment', 'm-purchase', 'm-received'].sort()
    )
  })

  it('drops order-driven and backfill-only reasons', () => {
    const excluded = [
      movement({ reason: 'sale' }),
      movement({ reason: 'sale-reversal' }),
      movement({ reason: 'purchase-reversal' }),
      movement({ reason: 'opening' }),
    ]
    expect(manualStockChanges(excluded)).toEqual([])
  })

  it('sorts newest first by occurredAt, not by array order', () => {
    const oldest = movement({ id: 'm-old', reason: 'received', occurredAt: '2026-01-01T00:00:00.000Z' })
    const newest = movement({ id: 'm-new', reason: 'received', occurredAt: '2026-03-01T00:00:00.000Z' })
    const middle = movement({ id: 'm-mid', reason: 'received', occurredAt: '2026-02-01T00:00:00.000Z' })
    expect(manualStockChanges([oldest, newest, middle]).map(m => m.id)).toEqual(['m-new', 'm-mid', 'm-old'])
  })
})
