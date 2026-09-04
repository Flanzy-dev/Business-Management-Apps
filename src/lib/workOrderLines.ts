// Rules for what happens when a product or service tile is tapped in the
// checkout catalog — pulled out of WorkOrderEditor.tsx's handleAddProduct/
// handleAddService, which each hand-wrote the same "does an existing line
// already represent this tap" rule (matching on productId or description,
// AND the resolved schedule tag, so a line the tech has hand-edited — e.g.
// untagged for an over-the-counter sale — never silently absorbs a fresh tap
// that would otherwise resolve tagged). Pure — callers pass the order's
// current items in, same discipline as orderLifecycle.ts/orderItemGroups.ts.
import type { WorkOrderItem } from '../store/workOrderStore'
import type { ProductWithStock } from './stockLedger'

/**
 * An existing line a product tap should bump instead of adding a new one —
 * same product AND same resolved schedule tag.
 */
export function findMatchingProductLine(
  items: WorkOrderItem[],
  productId: string,
  serviceItemTypeId: string | null
): WorkOrderItem | undefined {
  return items.find((i) => i.productId === productId && (i.serviceItemTypeId ?? null) === serviceItemTypeId)
}

/**
 * The new line for a product tap that found no existing line to bump. A
 * product resolving to a schedule item (src/lib/scheduleTagging.ts — by its
 * own override or its category, e.g. every engine-oil product tags "Oli
 * Mesin") is added already tagged as a "changed" service, the same shape
 * serviceCatalogLine gives a linked catalog service — this is what lets an
 * ordinary oil-off-the-shelf sale advance the vehicle's schedule without
 * anyone ticking a box.
 */
export function buildProductLine(product: ProductWithStock, serviceItemTypeId: string | null): Omit<WorkOrderItem, 'id' | 'lineTotal'> {
  return {
    description: product.name,
    quantity: 1,
    unitPrice: product.sellPrice,
    productId: product.id,
    ...(serviceItemTypeId
      ? { serviceItemTypeId, serviceAction: 'changed' as const, quantityLiters: null, containerType: null }
      : {}),
  }
}

/**
 * An existing line a service tap should bump — same description and
 * resolved schedule tag, and never a product-linked line (a labor service
 * never merges into a parts line of the same name).
 */
export function findMatchingServiceLine(
  items: WorkOrderItem[],
  line: Pick<WorkOrderItem, 'description' | 'serviceItemTypeId'>
): WorkOrderItem | undefined {
  return items.find(
    (i) => !i.productId && i.description === line.description && (i.serviceItemTypeId ?? null) === (line.serviceItemTypeId ?? null)
  )
}
