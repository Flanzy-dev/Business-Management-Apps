// Tests the store-writing runner (src/lib/ops/costingBackfill.ts), not the
// pure decisions (src/lib/__tests__/costingBackfill.test.ts, which tests
// src/lib/costingBackfill.ts directly). This runner used to reach
// useXStore.getState() singletons directly and had no tests at all — the
// property that matters most for a migration that runs once against real
// user data on app start is that a second run is a true no-op.
import { describe, it, expect } from 'vitest'
import { createCostingBackfillOps } from '../ops/costingBackfill'
import { buildFakeOpsDeps } from './helpers/fakeOpsDeps'
import type { WorkOrder } from '../../store/workOrderStore'

function completedOrder(overrides: Partial<WorkOrder> = {}): WorkOrder {
  return {
    id: 'wo-1',
    vehicleId: 'v-1',
    workerId: null,
    driverId: null,
    status: 'completed',
    paymentMethod: 'cash',
    items: [
      { id: 'item-1', productId: 'p-1', quantity: 2, unitPrice: 50_000, costOfGoods: null },
    ],
    createdAt: '2026-01-01T00:00:00.000Z',
    completedAt: '2026-01-01T00:10:00.000Z',
    orderNumber: 1,
    subtotal: 100_000,
    discount: 0,
    taxPercent: 0,
    total: 100_000,
    amountReceived: null,
    ...overrides,
  } as unknown as WorkOrder
  // Cast: only the fields freezeHistoricalCosts actually reads are filled in
  // — same "just enough of the shape" convention fakeOpsDeps itself uses.
}

describe('costingBackfill ops runner', () => {
  it('freezes cost on a completed order missing costOfGoods', () => {
    const world = buildFakeOpsDeps({
      products: [{ id: 'p-1', costPrice: 40_000 } as never],
      workOrders: [completedOrder()],
    })
    const { runCostingBackfill } = createCostingBackfillOps(world.deps)

    runCostingBackfill()

    const updated = world.workOrders.getWorkOrder('wo-1')!
    expect(updated.items[0].costOfGoods).toBe(80_000)
    expect(world.stockLots.backfilledAt).toBeTruthy()
  })

  it('is a no-op on a second run, even if the underlying order data would otherwise re-freeze', () => {
    const world = buildFakeOpsDeps({
      products: [{ id: 'p-1', costPrice: 40_000 } as never],
      workOrders: [completedOrder()],
    })
    const { runCostingBackfill } = createCostingBackfillOps(world.deps)

    runCostingBackfill()
    const afterFirst = world.workOrders.getWorkOrder('wo-1')!.items[0].costOfGoods

    // Simulate a cost-price edit after the backfill ran — if the guard were
    // missing, a second run would re-freeze at the new price and silently
    // move a past order's cost a second time.
    world.inventory.updateProduct('p-1', { costPrice: 999_999 })
    runCostingBackfill()

    expect(world.workOrders.getWorkOrder('wo-1')!.items[0].costOfGoods).toBe(afterFirst)
  })

  it('does nothing when backfilledAt is already set, even with fresh unfrozen orders', () => {
    const world = buildFakeOpsDeps({
      products: [{ id: 'p-1', costPrice: 40_000 } as never],
      workOrders: [completedOrder()],
      backfilledAt: '2026-01-01T00:00:00.000Z',
    })
    const { runCostingBackfill } = createCostingBackfillOps(world.deps)

    runCostingBackfill()

    expect(world.workOrders.getWorkOrder('wo-1')!.items[0].costOfGoods).toBeNull()
  })

  it('is a harmless no-op on a fresh install with nothing to freeze', () => {
    const world = buildFakeOpsDeps()
    const { runCostingBackfill } = createCostingBackfillOps(world.deps)

    expect(() => runCostingBackfill()).not.toThrow()
    expect(world.stockLots.backfilledAt).toBeTruthy()
  })
})
