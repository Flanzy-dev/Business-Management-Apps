// Changing the lines of an open order — the rules that used to live in
// WorkOrderEditor.tsx's event handlers, where nothing could test them.
//
// - Tap-to-add a product: refused when nothing is left after what this order's
//   own lines already hold; a repeat tap bumps the matching line (same product
//   AND same resolved schedule tag — workOrderLines.ts) instead of stacking.
// - Tap-to-add a service: same bump rule, no stock guard — labor can't run out.
// - +/- on a line: zero removes it; growing a product line is stock-guarded.
// - Saving the line dialog: a product line may grow to "what's still free
//   plus what this line already holds", never past it.
// - Removing a line hands it back, so the ticket can offer Undo; putting it
//   back is stock-guarded like any other add.
//
// Every call reads the order fresh through `deps` rather than trusting a
// caller's snapshot. That's load-bearing, not tidiness: two taps landing in one
// React batch (a fast double-click) must each see the other's line, or both
// find "no existing line" and add two. The editor used to get this right by
// reaching into useWorkOrderStore.getState() itself; it's a property of the op
// now.
import type { WorkOrderItem } from '../../store/workOrderStore'
import type { ServiceCatalogItem } from '../../store/serviceCatalogStore'
import { remainingStock } from '../orders/orderLifecycle'
import { withStock, type ProductWithStock } from '../inventory/stockLedger'
import { buildProductLine, findMatchingProductLine, findMatchingServiceLine } from '../orders/workOrderLines'
import { serviceCatalogLine } from '../schedule/serviceCatalog'
import { resolveProductScheduleTag } from '../schedule/scheduleTagging'
import type { LineItemDraft } from '../orders/lineItemForm'
import { realOpsDeps, type OpsDeps } from './deps'

export type OrderLineResult =
  | { ok: true }
  /** Nothing of this product is free after this order's own lines. */
  | { ok: false; reason: 'outOfStock'; product: ProductWithStock }
  /** The change asks for more than `available`. */
  | { ok: false; reason: 'insufficientStock'; product: ProductWithStock; available: number }

const OK: OrderLineResult = { ok: true }

export type OrderLineOpsDeps = Pick<OpsDeps, 'workOrders' | 'inventory' | 'movements' | 'productCategories' | 'serviceItemTypes'>

export function createOrderLineOps(deps: OrderLineOpsDeps) {
  const itemsOf = (orderId: string): WorkOrderItem[] =>
    deps.workOrders.getState().workOrders.find((wo) => wo.id === orderId)?.items ?? []

  const productWithStock = (productId: string): ProductWithStock | undefined => {
    const product = deps.inventory.getState().products.find((p) => p.id === productId)
    return product ? withStock([product], deps.movements.getState().movements)[0] : undefined
  }

  function addProductToOrder(orderId: string, productId: string): OrderLineResult {
    const product = productWithStock(productId)
    if (!product) return OK
    const items = itemsOf(orderId)
    if (remainingStock(items, product) <= 0) return { ok: false, reason: 'outOfStock', product }

    const tag = resolveProductScheduleTag(
      product,
      deps.productCategories.getState().categories,
      deps.serviceItemTypes.getState().serviceItemTypes
    ) ?? null
    const store = deps.workOrders.getState()
    const existing = findMatchingProductLine(items, product.id, tag)
    if (existing) store.updateItem(orderId, existing.id, { quantity: existing.quantity + 1 })
    else store.addItem(orderId, buildProductLine(product, tag))
    return OK
  }

  function addServiceToOrder(orderId: string, service: ServiceCatalogItem): OrderLineResult {
    const line = serviceCatalogLine(service)
    const store = deps.workOrders.getState()
    const existing = findMatchingServiceLine(itemsOf(orderId), line)
    if (existing) store.updateItem(orderId, existing.id, { quantity: existing.quantity + 1 })
    else store.addItem(orderId, line)
    return OK
  }

  function changeLineQuantity(orderId: string, lineId: string, delta: number): OrderLineResult {
    const items = itemsOf(orderId)
    const line = items.find((i) => i.id === lineId)
    if (!line) return OK
    const store = deps.workOrders.getState()
    const next = line.quantity + delta
    if (next <= 0) {
      store.removeItem(orderId, lineId)
      return OK
    }
    if (delta > 0 && line.productId) {
      const product = productWithStock(line.productId)
      if (product && remainingStock(items, product) <= 0) {
        return { ok: false, reason: 'insufficientStock', product, available: Math.max(0, remainingStock(items, product)) }
      }
    }
    store.updateItem(orderId, lineId, { quantity: next })
    return OK
  }

  /**
   * The line dialog's save: `lineId` null adds a custom (non-product) line;
   * otherwise it edits that line, capped for a product line at what's still
   * free plus what the line already holds.
   */
  function saveLine(orderId: string, lineId: string | null, draft: LineItemDraft): OrderLineResult {
    const fields = {
      description: draft.description,
      quantity: draft.quantity,
      unitPrice: draft.unitPrice,
      kind: draft.kind,
      serviceItemTypeId: draft.serviceItemTypeId,
      quantityLiters: draft.quantityLiters,
      serviceAction: draft.serviceAction,
      containerType: draft.containerType,
      requestedIntervalKm: draft.requestedIntervalKm,
    }
    const store = deps.workOrders.getState()
    if (lineId === null) {
      store.addItem(orderId, { ...fields, productId: null })
      return OK
    }

    const items = itemsOf(orderId)
    const line = items.find((i) => i.id === lineId)
    if (!line) return OK
    if (line.productId) {
      const product = productWithStock(line.productId)
      const allowed = product ? remainingStock(items, product) + line.quantity : Infinity
      if (product && draft.quantity > allowed) {
        return { ok: false, reason: 'insufficientStock', product, available: Math.max(0, allowed) }
      }
    }
    store.updateItem(orderId, lineId, fields)
    return OK
  }

  /** Removes the line and returns it (null if it was already gone), for Undo. */
  function removeLine(orderId: string, lineId: string): WorkOrderItem | null {
    const line = itemsOf(orderId).find((i) => i.id === lineId)
    if (!line) return null
    deps.workOrders.getState().removeItem(orderId, lineId)
    return line
  }

  /** Undo for removeLine: puts the line back, unless another order took the
   *  stock in the meantime. It returns at the end of the ticket, with a new id. */
  function restoreLine(orderId: string, line: WorkOrderItem): OrderLineResult {
    const items = itemsOf(orderId)
    if (line.productId) {
      const product = productWithStock(line.productId)
      const available = product ? remainingStock(items, product) : Infinity
      if (product && line.quantity > available) {
        return { ok: false, reason: 'insufficientStock', product, available: Math.max(0, available) }
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, lineTotal, ...rest } = line
    deps.workOrders.getState().addItem(orderId, rest)
    return OK
  }

  return { addProductToOrder, addServiceToOrder, changeLineQuantity, saveLine, removeLine, restoreLine }
}

// The one real instance the running app uses.
const defaultOps = createOrderLineOps(realOpsDeps)
export const addProductToOrder = defaultOps.addProductToOrder
export const addServiceToOrder = defaultOps.addServiceToOrder
export const changeLineQuantity = defaultOps.changeLineQuantity
export const saveLine = defaultOps.saveLine
export const removeLine = defaultOps.removeLine
export const restoreLine = defaultOps.restoreLine
