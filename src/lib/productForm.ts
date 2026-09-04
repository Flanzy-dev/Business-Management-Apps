// The Add/Edit Product dialog's own rules, pulled out of the component that
// renders it (src/components/inventory/ProductFormDialog.tsx) — same
// reasoning as vehicleForm.ts/newOrderForm.ts. Two real correctness rules
// lived here: the schedule-item sentinel mapping (undefined = inherit the
// category's mapping, null = deliberately none, or a specific
// ServiceItemType id — see scheduleTagging.ts) was hand-written in both
// directions ~40 lines apart in the component, and the duplicate-name
// restock offer's decision logic was interleaved with its toast text.
import type { Product } from '../store/inventoryStore'
import type { ProductWithStock } from './stockLedger'
import type { ProductDuplicate } from './productIdentity'
import { normalizeSupplierCode } from './productIdentity'
import type { StockPurchase } from './ops/inventoryOps'

// Sentinels for the schedule-item select — real ids are ServiceItemType.id
// strings, so these just need to never collide with one.
export const INHERIT_SCHEDULE_ITEM = '__inherit__'
export const NO_SCHEDULE_ITEM = '__none__'

/** Product.serviceItemTypeId -> the select's draft value. The one direction;
 *  scheduleItemFromDraft is its exact inverse — keep them next to each other. */
export function scheduleItemToDraft(serviceItemTypeId: string | null | undefined): string {
  if (serviceItemTypeId === undefined) return INHERIT_SCHEDULE_ITEM
  if (serviceItemTypeId === null) return NO_SCHEDULE_ITEM
  return serviceItemTypeId
}

/** The select's draft value -> what gets saved onto the product. */
export function scheduleItemFromDraft(draft: string): string | null | undefined {
  if (draft === INHERIT_SCHEDULE_ITEM) return undefined
  if (draft === NO_SCHEDULE_ITEM) return null
  return draft
}

export interface ProductDraft {
  name: string
  sku: string
  supplierCode: string
  category: string
  unit: string
  /** One of INHERIT_SCHEDULE_ITEM/NO_SCHEDULE_ITEM/a ServiceItemType id — see scheduleItemToDraft/FromDraft. */
  scheduleItemOverride: string
  costPrice: string
  sellPrice: string
  qtyOnHand: string
  reorderPoint: string
  supplierId: string
  notes: string
  recordInitialExpense: boolean
}

/** Where the form starts: an existing product's values when editing, else
 *  blank with this dialog's defaults for a new one. */
export function initialProductDraft(product: ProductWithStock | null): ProductDraft {
  return {
    name: product?.name ?? '',
    sku: product?.sku ?? '',
    supplierCode: product?.supplierCode ?? '',
    category: product?.category ?? 'Oli Mesin Diesel',
    unit: product?.unit ?? 'each',
    scheduleItemOverride: scheduleItemToDraft(product?.serviceItemTypeId),
    costPrice: product ? product.costPrice.toString() : '',
    sellPrice: product ? product.sellPrice.toString() : '',
    qtyOnHand: product ? product.qtyOnHand.toString() : '0',
    reorderPoint: product ? product.reorderPoint.toString() : '5',
    supplierId: product?.supplierId || '',
    notes: product?.notes ?? '',
    recordInitialExpense: true,
  }
}

export type ProductDraftValidation =
  | { ok: true }
  | { ok: false; nameRequired: boolean; sellPriceRequired: boolean }

/** Surfaces both required-field problems at once — same shape as
 *  vehicleForm.ts's DraftValidation — even though the dialog currently only
 *  ever toasts whichever it checks first (name, then sell price). */
export function validateProductDraft(draft: ProductDraft): ProductDraftValidation {
  const nameRequired = !draft.name.trim()
  const sellPriceRequired = !draft.sellPrice
  if (!nameRequired && !sellPriceRequired) return { ok: true }
  return { ok: false, nameRequired, sellPriceRequired }
}

/** The stored-shape fields both createProduct and updateProduct take —
 *  everything except id/createdAt/qty-on-hand (qty is a separate FIFO lot,
 *  not a Product field; see inventoryOps.ts). */
export function productDraftToData(draft: ProductDraft): Omit<Product, 'id' | 'createdAt'> {
  return {
    name: draft.name,
    sku: draft.sku,
    supplierCode: normalizeSupplierCode(draft.supplierCode),
    category: draft.category,
    unit: draft.unit,
    costPrice: Math.round(parseFloat(draft.costPrice || '0')),
    sellPrice: Math.round(parseFloat(draft.sellPrice) || 0),
    reorderPoint: parseInt(draft.reorderPoint) || 0,
    supplierId: draft.supplierId || null,
    notes: draft.notes,
    serviceItemTypeId: scheduleItemFromDraft(draft.scheduleItemOverride),
  }
}

export type DuplicateResolution<T extends Product = Product> =
  /** A name clash with stock to add — offer to restock the existing product instead of blocking. */
  | { kind: 'offerRestock'; product: T }
  /** Any other clash (a SKU clash, or a name clash while editing/with no qty to add) — save is blocked. */
  | { kind: 'blocked'; field: 'name' | 'sku'; product: T }
  | { kind: 'none' }

/**
 * What a live duplicate match means for Save. Adding a product that already
 * exists is almost always a restock, so that's offered — but only for a name
 * clash, on a brand-new product, with stock to add. A SKU clash means two
 * differently-named rows share a code: merging "Castrol" into "Shell" would
 * compound the typo, so that always blocks. Generic over T (matching
 * ProductDuplicate's own T) so a caller passing ProductWithStock rows gets
 * ProductWithStock rows back, no cast needed.
 */
export function duplicateResolution<T extends Product>(
  duplicate: ProductDuplicate<T> | null,
  isNewProduct: boolean,
  incomingQty: number
): DuplicateResolution<T> {
  if (!duplicate) return { kind: 'none' }
  if (isNewProduct && duplicate.field === 'name' && incomingQty > 0) {
    return { kind: 'offerRestock', product: duplicate.product }
  }
  return { kind: 'blocked', field: duplicate.field, product: duplicate.product }
}

/** The toast for a 'blocked' resolution, or null for the other two cases —
 *  same `const toast = xToast(outcome); if (toast) showToast(toast)` shape
 *  as deleteOutcome.ts. `productName` is the *incoming* draft's name/sku
 *  error text; `t` is the caller's translate function. */
export function duplicateResolutionToast(
  resolution: DuplicateResolution<Product>,
  t: (key: string, vars?: Record<string, string>) => string
): { tone: 'danger'; title: string } | null {
  if (resolution.kind !== 'blocked') return null
  return {
    tone: 'danger',
    title: t(resolution.field === 'name' ? 'inventory.duplicateNameError' : 'inventory.duplicateSkuError', {
      product: resolution.product.name,
    }),
  }
}

/**
 * The linked-purchase payload for an initial-stock expense, or null when
 * nothing should be recorded — shared by both createProduct's initial
 * quantity and DuplicateProductDialog's restock-onto-an-existing-product
 * path, so the "record initial stock expense" checkbox behaves identically
 * either way.
 */
export function initialPurchase(
  recordInitialExpense: boolean,
  qty: number,
  unitCost: number,
  vendor: string,
  description: string
): StockPurchase | null {
  if (!recordInitialExpense || qty <= 0) return null
  return { amount: qty * unitCost, vendor, description }
}
