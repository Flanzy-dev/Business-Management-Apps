// What makes two inventory rows "the same product". Pure — the Inventory page
// passes its own list in. Two records sharing a name split the shop's stock in
// half: each accumulates its own FIFO lots, the checkout shows two identical
// tiles, and the low-stock alert fires on something that is really in stock
// under the other row.
import type { Product } from '../store/inventoryStore'

export type DuplicateField = 'name' | 'sku'

export interface ProductDuplicate<T extends Product = Product> {
  product: T
  field: DuplicateField
}

/** Trimmed + lowercased, so "  Shell HX7  " and "shell hx7" are one product. */
function normalize(value: string): string {
  return value.trim().toLowerCase()
}

/**
 * The name form two records are compared by. Exported because
 * src/lib/productImport.ts decides "does this row already exist?" the same
 * way — a bulk import and the Add Product form disagreeing about what counts
 * as the same product is exactly the split-stock bug above.
 */
export function normalizeProductName(name: string): string {
  return normalize(name)
}

/**
 * The *stored* form of a supplier code: trimmed and uppercased, so "shl-01"
 * and " SHL-01 " are one code. Uppercase rather than lower because that's how
 * vendors print part numbers, and storing the normalized form (instead of
 * normalizing at each read) means what the table shows, what search matches,
 * and what the CSV exports are all one string.
 *
 * Deliberately *not* checked for uniqueness. This shop's codes come from its
 * price lists' "modal" column, which encodes what an item cost — so products
 * bought at the same price share a code (all four Turalik 43/45 variants are
 * "ES"). Enforcing uniqueness here would silently blank most of them.
 */
export function normalizeSupplierCode(code: string): string {
  return code.trim().toUpperCase()
}

/**
 * The existing product a name/SKU would collide with, or null.
 *
 * `excludeId` is the record being edited — a product can never clash with
 * itself. A blank SKU never matches anything, including another blank: SKU is
 * optional here and most products leave it empty, so treating blanks as equal
 * would make every unlabelled product a duplicate of the last one.
 *
 * When both fields clash, the name wins: it's what the cashier reads on the
 * tile and the receipt, and it's the case the Inventory page can offer to
 * resolve by restocking instead.
 *
 * `supplierCode` is not considered — see normalizeSupplierCode above for why
 * two products sharing one is normal here.
 */
export function findDuplicateProduct<T extends Product>(
  products: T[],
  candidate: { name: string; sku: string },
  excludeId?: string
): ProductDuplicate<T> | null {
  const name = normalize(candidate.name)
  const sku = normalize(candidate.sku)
  const others = products.filter(p => p.id !== excludeId)

  if (name) {
    const clash = others.find(p => normalize(p.name) === name)
    if (clash) return { product: clash, field: 'name' }
  }
  if (sku) {
    const clash = others.find(p => normalize(p.sku) === sku)
    if (clash) return { product: clash, field: 'sku' }
  }
  return null
}
