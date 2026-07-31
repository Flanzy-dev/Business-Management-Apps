// Store-writing half of the one-time move to FIFO lot costing. Runs once per
// install, from App.tsx on mount; the pure decisions live in
// src/lib/costingBackfill.ts. Giving pre-existing stock an opening lot is now
// src/lib/ops/stockLedgerBackfill.ts's job, run separately.
import { useInventoryStore } from '../../store/inventoryStore'
import { useStockLotStore } from '../../store/stockLotStore'
import { useWorkOrderStore } from '../../store/workOrderStore'
import { freezeHistoricalCosts } from '../costingBackfill'

/**
 * Give pre-existing sales a frozen cost, so a report never moves just because
 * someone edited a product's cost price. No-op once `backfilledAt` is set —
 * skips anything already done, so a crash part-way through simply re-runs the
 * whole thing on next launch.
 */
export function runCostingBackfill(): void {
  const lotStore = useStockLotStore.getState()
  if (lotStore.backfilledAt) return

  const products = useInventoryStore.getState().products
  const workOrderStore = useWorkOrderStore.getState()

  const costPriceByProductId = new Map(products.map(p => [p.id, p.costPrice]))
  for (const { orderId, items } of freezeHistoricalCosts(workOrderStore.workOrders, costPriceByProductId)) {
    workOrderStore.updateWorkOrder(orderId, { items })
  }

  lotStore.markBackfilled(new Date().toISOString())
}
