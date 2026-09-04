// CheckoutCatalog's category/search filtering and single-match auto-commit
// rules, pulled out of the component's useMemo bodies and Enter-key handler
// — same "real rules belong in a plain .ts, not a component body" reasoning
// as every other extracted form/filter module in this codebase. Pure —
// callers pass the product/service arrays in.
import type { ProductWithStock } from './stockLedger'
import type { ServiceCatalogItem } from '../store/serviceCatalogStore'
import type { WorkOrderItem } from '../store/workOrderStore'
import { remainingStock } from './orderLifecycle'
import { matchesQuery } from './productFilter'
import { rankServicesByUsage } from './serviceSuggestions'

export const ALL_CATEGORIES = '__all__'
export const SERVICES_CATEGORY = '__services__'

/** Services matching the current category/search — none at all once a
 *  specific product category is picked (services have no category). */
export function filterVisibleServices(
  services: ServiceCatalogItem[],
  category: string,
  query: string,
  serviceUsage: Map<string, number>
): ServiceCatalogItem[] {
  if (category !== ALL_CATEGORIES && category !== SERVICES_CATEGORY) return []
  return rankServicesByUsage(
    services.filter((s) => !query || s.name.toLowerCase().includes(query)),
    serviceUsage
  )
}

/** Products matching the current category/search — none at all once the
 *  Services-only category is picked. */
export function filterVisibleProducts(products: ProductWithStock[], category: string, query: string): ProductWithStock[] {
  if (category === SERVICES_CATEGORY) return []
  return products.filter((p) => {
    // Product.category stores the plain category *name*, not an id.
    if (category !== ALL_CATEGORIES && p.category !== category) return false
    if (!query) return true
    // Same rule as the Inventory search box, deliberately shared: a part
    // number that finds a product there has to find it here too.
    return matchesQuery(p, query)
  })
}

export type SingleMatch = { kind: 'service'; service: ServiceCatalogItem } | { kind: 'product'; product: ProductWithStock } | null

/**
 * Typing two letters and hitting Enter is the register habit — when the
 * search has narrowed to exactly one addable tile (a product with stock
 * left, or any service — services never run out), this is what Enter
 * commits. `null` when zero or more than one tile still qualifies.
 */
export function singleAddableMatch(visibleServices: ServiceCatalogItem[], visibleProducts: ProductWithStock[], items: WorkOrderItem[]): SingleMatch {
  const addableProducts = visibleProducts.filter((p) => remainingStock(items, p) > 0)
  if (addableProducts.length + visibleServices.length !== 1) return null
  if (visibleServices.length === 1) return { kind: 'service', service: visibleServices[0] }
  return { kind: 'product', product: addableProducts[0] }
}

/** How many of this product are already on the ticket — drives ProductTile's badge. */
export function onTicketCountFor(items: WorkOrderItem[], productId: string): number {
  return items.filter((i) => i.productId === productId).reduce((sum, i) => sum + i.quantity, 0)
}
