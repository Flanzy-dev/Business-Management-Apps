// Which products the shop actually sells, for the order screen's catalog: the
// ones that sell most are pinned on top, so the counter doesn't scroll through
// 500 A–Z rows for the oil and filters it sells every day. The product
// counterpart of serviceUsageCounts (src/lib/schedule/serviceSuggestions.ts).
import type { WorkOrder } from '../../store/workOrderStore'
import type { ProductWithStock } from '../inventory/stockLedger'

/** How many times each product was sold, keyed by product id: one count per
 *  line on a completed order. A quoted-then-abandoned ticket says nothing about
 *  what the shop actually sells, so open and voided orders don't count. */
export function productUsageCounts(orders: WorkOrder[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const order of orders) {
    if (order.status !== 'completed') continue
    for (const item of order.items) {
      if (!item.productId) continue
      counts.set(item.productId, (counts.get(item.productId) ?? 0) + 1)
    }
  }
  return counts
}

export interface FrequentSplit {
  /** Best sellers, most sold first (ties keep the catalog's own order). */
  frequent: ProductWithStock[]
  /** Everything else, in the order it came in — never repeats a pinned product. */
  rest: ProductWithStock[]
}

/**
 * Splits already-filtered products into the pinned best sellers and the rest.
 * Only products that have sold at least once qualify, so with no sales history
 * `frequent` is empty and nothing changes.
 */
export function splitFrequentProducts(products: ProductWithStock[], usage: Map<string, number>, limit: number): FrequentSplit {
  const frequent = products
    .map((product, index) => ({ product, index, count: usage.get(product.id) ?? 0 }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count || a.index - b.index)
    .slice(0, limit)
    .map((entry) => entry.product)
  const pinned = new Set(frequent.map((p) => p.id))
  return { frequent, rest: products.filter((p) => !pinned.has(p.id)) }
}
