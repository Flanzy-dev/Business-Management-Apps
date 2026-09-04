// The store-touching half of inventoryOps — everything inventoryOps.test.ts
// couldn't reach while the module read singletons directly. Driven through
// createInventoryOps(deps) with in-memory fakes, so nothing here shares state
// with another test file.
import { describe, it, expect } from 'vitest'
import { createInventoryOps } from '../ops/inventoryOps'
import { buildFakeOpsDeps } from './helpers/fakeOpsDeps'
import type { Product } from '../../store/inventoryStore'
import type { Expense } from '../../store/expenseStore'
import type { StockLot } from '../../store/stockLotStore'
import type { StockMovement } from '../../store/stockMovementStore'
import { qtyOnHand } from '../stockLedger'

const NOW = new Date('2026-08-10T09:00:00.000Z')

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p-1',
    name: 'Helix HX3 20/50 1 L',
    sku: '',
    supplierCode: '',
    category: 'Oli Mesin Bensin',
    unit: 'each',
    costPrice: 60_000,
    sellPrice: 80_000,
    reorderPoint: 0,
    supplierId: null,
    notes: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

/** What createProduct actually takes — it stamps id/createdAt itself, so those
 *  two must be absent rather than present-and-undefined. */
function newProductData(overrides: Partial<Product> = {}): Omit<Product, 'id' | 'createdAt'> {
  const { id: _id, createdAt: _createdAt, ...data } = product(overrides)
  return data
}

function lot(overrides: Partial<StockLot> = {}): StockLot {
  return {
    id: 'lot-1',
    productId: 'p-1',
    unitCost: 60_000,
    qtyReceived: 10,
    receivedAt: '2026-02-01T00:00:00.000Z',
    expenseId: null,
    createdAt: '2026-02-01T00:00:00.000Z',
    ...overrides,
  } as StockLot
}

function movement(overrides: Partial<StockMovement> = {}): StockMovement {
  return {
    id: 'm-1',
    productId: 'p-1',
    delta: 10,
    reason: 'purchase',
    lotId: 'lot-1',
    unitCost: 60_000,
    refType: null,
    refId: null,
    occurredAt: '2026-02-01T00:00:00.000Z',
    deviceId: 'seed',
    createdAt: '2026-02-01T00:00:00.000Z',
    ...overrides,
  } as StockMovement
}

function linkedExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 'e-1',
    date: '2026-02-01',
    category: 'Inventory Purchase',
    description: 'Restock',
    amount: 600_000,
    vendor: 'Acme',
    notes: '',
    productId: 'p-1',
    quantityAffected: 10,
    createdAt: '2026-02-01T00:00:00.000Z',
    ...overrides,
  } as Expense
}

describe('restockProduct', () => {
  it('opens a lot at what was paid and records the movement, with a linked expense', () => {
    const world = buildFakeOpsDeps({ products: [product()], now: NOW })
    createInventoryOps(world.deps).restockProduct('p-1', 4, {
      amount: 260_000,
      vendor: 'Acme',
      description: 'Restock',
    })

    expect(world.expenses.expenses).toHaveLength(1)
    expect(world.expenses.expenses[0].amount).toBe(260_000)
    expect(world.stockLots.stockLots[0].unitCost).toBe(65_000) // 260.000 / 4
    expect(world.movements.movements[0]).toMatchObject({ delta: 4, reason: 'purchase' })
    // The lot, the movement and the expense are one event — they must agree.
    expect(world.movements.movements[0].refId).toBe(world.expenses.expenses[0].id)
    expect(world.stockLots.stockLots[0].expenseId).toBe(world.expenses.expenses[0].id)
  })

  it('falls back to the product cost price when no purchase is recorded', () => {
    const world = buildFakeOpsDeps({ products: [product({ costPrice: 55_000 })], now: NOW })
    createInventoryOps(world.deps).restockProduct('p-1', 2, null)

    expect(world.expenses.expenses).toEqual([])
    expect(world.stockLots.stockLots[0].unitCost).toBe(55_000)
    expect(world.movements.movements[0].reason).toBe('received')
  })

  it('drains the oldest lot first on a negative quantity', () => {
    const world = buildFakeOpsDeps({
      products: [product()],
      stockLots: [
        lot({ id: 'old', unitCost: 50_000, qtyReceived: 3, receivedAt: '2026-01-01T00:00:00.000Z' }),
        lot({ id: 'new', unitCost: 70_000, qtyReceived: 5, receivedAt: '2026-03-01T00:00:00.000Z' }),
      ],
      movements: [
        movement({ id: 'm-old', delta: 3, lotId: 'old' }),
        movement({ id: 'm-new', delta: 5, lotId: 'new' }),
      ],
      now: NOW,
    })
    createInventoryOps(world.deps).restockProduct('p-1', -4, null)

    const drawn = world.movements.movements.filter((m) => m.reason === 'adjustment')
    expect(drawn.map((m) => [m.lotId, m.delta])).toEqual([
      ['old', -3],
      ['new', -1],
    ])
    expect(qtyOnHand(world.movements.movements, 'p-1')).toBe(4)
  })
})

describe('createProduct', () => {
  it('opens the first lot for an initial quantity', () => {
    const world = buildFakeOpsDeps({ now: NOW })
    const created = createInventoryOps(world.deps).createProduct(
      newProductData(),
      5,
      { amount: 300_000, vendor: 'Acme', description: 'Opening stock' }
    )

    expect(world.inventory.products).toHaveLength(1)
    expect(world.stockLots.stockLots[0].productId).toBe(created.id)
    expect(qtyOnHand(world.movements.movements, created.id)).toBe(5)
  })

  it('creates no lot and no expense at zero opening quantity', () => {
    const world = buildFakeOpsDeps({ now: NOW })
    createInventoryOps(world.deps).createProduct(
      newProductData(),
      0,
      { amount: 1, vendor: 'Acme', description: 'x' }
    )

    expect(world.stockLots.stockLots).toEqual([])
    expect(world.movements.movements).toEqual([])
    expect(world.expenses.expenses).toEqual([])
  })
})

describe('deleteExpenseWithStockReversal', () => {
  it('reverses the whole quantity against the lot when none of it has sold', () => {
    const world = buildFakeOpsDeps({
      products: [product()],
      expenses: [linkedExpense()],
      stockLots: [lot({ expenseId: 'e-1' })],
      movements: [movement()],
      now: NOW,
    })
    createInventoryOps(world.deps).deleteExpenseWithStockReversal('e-1')

    const reversals = world.movements.movements.filter((m) => m.reason === 'purchase-reversal')
    expect(reversals).toHaveLength(1)
    expect(reversals[0]).toMatchObject({ delta: -10, lotId: 'lot-1' })
    expect(qtyOnHand(world.movements.movements, 'p-1')).toBe(0)
    expect(world.expenses.expenses).toEqual([])
  })

  it('clamps at what is left in the lot and books the rest unattributed', () => {
    // 10 arrived, 6 already sold: only 4 can come back out of that lot, but
    // the product total must still fall by the full 10 the expense claimed.
    const world = buildFakeOpsDeps({
      products: [product()],
      expenses: [linkedExpense()],
      stockLots: [lot({ expenseId: 'e-1' })],
      movements: [movement(), movement({ id: 'm-sale', delta: -6, reason: 'sale' })],
      now: NOW,
    })
    createInventoryOps(world.deps).deleteExpenseWithStockReversal('e-1')

    const reversals = world.movements.movements.filter((m) => m.reason === 'purchase-reversal')
    expect(reversals.map((m) => [m.lotId, m.delta])).toEqual([
      ['lot-1', -4],
      [null, -6],
    ])
    expect(qtyOnHand(world.movements.movements, 'p-1')).toBe(-6)
  })

  it('books the whole reversal unattributed when the lot is gone', () => {
    const world = buildFakeOpsDeps({
      products: [product()],
      expenses: [linkedExpense()],
      stockLots: [],
      movements: [movement({ lotId: null })],
      now: NOW,
    })
    createInventoryOps(world.deps).deleteExpenseWithStockReversal('e-1')

    const reversals = world.movements.movements.filter((m) => m.reason === 'purchase-reversal')
    expect(reversals).toHaveLength(1)
    expect(reversals[0]).toMatchObject({ lotId: null, delta: -10, unitCost: 60_000 })
  })

  it('is a safe no-op for an expense that never touched stock', () => {
    const world = buildFakeOpsDeps({
      expenses: [linkedExpense({ id: 'rent', productId: null, quantityAffected: null })],
      now: NOW,
    })
    createInventoryOps(world.deps).deleteExpenseWithStockReversal('rent')

    expect(world.movements.movements).toEqual([])
    expect(world.expenses.expenses).toEqual([])
  })
})

describe('reconcileStock', () => {
  it('appends the difference rather than editing history', () => {
    const world = buildFakeOpsDeps({
      products: [product()],
      movements: [movement({ delta: 2 }), movement({ id: 'm-2', delta: -5, reason: 'sale' })],
      now: NOW,
    })
    expect(qtyOnHand(world.movements.movements, 'p-1')).toBe(-3)

    createInventoryOps(world.deps).reconcileStock('p-1', 1)

    // The oversell stays in the ledger; a +4 adjustment brings it to the count.
    expect(world.movements.movements).toHaveLength(3)
    expect(world.movements.movements[2]).toMatchObject({ delta: 4, reason: 'adjustment' })
    expect(qtyOnHand(world.movements.movements, 'p-1')).toBe(1)
  })

  it('writes nothing when the count already matches', () => {
    const world = buildFakeOpsDeps({ products: [product()], movements: [movement({ delta: 7 })], now: NOW })
    createInventoryOps(world.deps).reconcileStock('p-1', 7)
    expect(world.movements.movements).toHaveLength(1)
  })
})
