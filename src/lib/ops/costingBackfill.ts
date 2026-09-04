// Store-writing half of the one-time move to FIFO lot costing. Runs once per
// install, from App.tsx on mount; the pure decisions live in
// src/lib/costingBackfill.ts. Giving pre-existing stock an opening lot is now
// src/lib/ops/stockLedgerBackfill.ts's job, run separately.
//
// Stores arrive through `deps` (src/lib/ops/deps.ts), same createXOps(deps) +
// bound-default shape every other ops file uses — this one used to reach
// useXStore.getState() singletons directly, which is why it had no tests: a
// migration that runs once against real user data is exactly the code that
// most needs to be exercisable from a fake.
import { realOpsDeps, type OpsDeps } from './deps'
import { freezeHistoricalCosts } from '../costingBackfill'

export type CostingBackfillOpsDeps = Pick<OpsDeps, 'inventory' | 'stockLots' | 'workOrders'>

export function createCostingBackfillOps(deps: CostingBackfillOpsDeps) {
  /**
   * Give pre-existing sales a frozen cost, so a report never moves just because
   * someone edited a product's cost price. No-op once `backfilledAt` is set —
   * skips anything already done, so a crash part-way through simply re-runs the
   * whole thing on next launch.
   */
  function runCostingBackfill(): void {
    const lotStore = deps.stockLots.getState()
    if (lotStore.backfilledAt) return

    const products = deps.inventory.getState().products
    const workOrderStore = deps.workOrders.getState()

    const costPriceByProductId = new Map(products.map((p) => [p.id, p.costPrice]))
    for (const { orderId, items } of freezeHistoricalCosts(workOrderStore.workOrders, costPriceByProductId)) {
      workOrderStore.updateWorkOrder(orderId, { items })
    }

    lotStore.markBackfilled(new Date().toISOString())
  }

  return { runCostingBackfill }
}

// The one real instance the running app uses.
const defaultOps = createCostingBackfillOps(realOpsDeps)

export const runCostingBackfill = defaultOps.runCostingBackfill
