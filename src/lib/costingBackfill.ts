// Pure half of the one-time move to FIFO lot costing (the store-writing half
// is src/lib/ops/costingBackfill.ts). Shops that have been running before lot
// costing existed have completed sales with no recorded cost; this function
// says exactly what to stamp. Giving pre-existing *stock* an opening lot is
// now the stock ledger's job — see src/lib/stockLedgerBackfill.ts — since a
// lot with no ledger movement behind it wouldn't count toward derived stock.
import type { WorkOrder } from '../store/workOrderStore'

export interface FrozenOrderCost {
  orderId: string
  items: WorkOrder['items']
}

/**
 * Freeze the cost of sales made before lot costing. Each completed order's
 * product lines get `costOfGoods` at today's cost price — not perfectly
 * accurate for an old sale, but it stops those months from moving every time
 * someone edits a cost price. Only orders that actually change are returned.
 */
export function freezeHistoricalCosts(
  orders: WorkOrder[],
  costPriceByProductId: Map<string, number>
): FrozenOrderCost[] {
  const frozen: FrozenOrderCost[] = []
  for (const order of orders) {
    if (order.status !== 'completed') continue
    let changed = false
    const items = order.items.map(item => {
      if (!item.productId || item.costOfGoods != null) return item
      changed = true
      const cost = costPriceByProductId.get(item.productId) ?? 0
      return { ...item, costOfGoods: Math.round(item.quantity * cost) }
    })
    if (changed) frozen.push({ orderId: order.id, items })
  }
  return frozen
}
