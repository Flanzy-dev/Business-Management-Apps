// Narrowing and ordering the product table. Pure — no stores, no hooks: the
// Inventory page passes its own already-enriched list in, the same shape as
// stockLedger.ts and productImport.ts, so every rule here is testable without
// rendering a table.
//
// Worth having as its own module rather than inline `.filter()` chains: with a
// few hundred products imported from a price list, "which ones cost the most",
// "what haven't I priced yet" and "what does this supplier sell me" are the
// questions the page exists to answer, and each one is a rule that can be
// wrong on its own.
import type { ProductWithStock } from './stockLedger'
import { isLowStock } from './stockLedger'

/** Stock buckets the filter offers. 'low'/'oversold' match the table's badges. */
export type StockStatus = 'all' | 'in' | 'out' | 'low' | 'oversold'

export interface ProductFilters {
  /** Matched against name, SKU and supplier part number. */
  search: string
  /** Empty = every category. Holds raw stored category names, not labels. */
  categories: string[]
  /** null = any supplier; '' = only products with no supplier set. */
  supplierId: string | null
  stockStatus: StockStatus
  /** Inclusive bounds in whole Rupiah; null = unbounded. */
  minPrice: number | null
  maxPrice: number | null
  /** Only products with no sell price yet — see the "No price" badge. */
  missingPriceOnly: boolean
}

export const NO_FILTERS: ProductFilters = {
  search: '',
  categories: [],
  supplierId: null,
  stockStatus: 'all',
  minPrice: null,
  maxPrice: null,
  missingPriceOnly: false,
}

/**
 * How many filters are narrowing the list — the number on the Filter button.
 * Search is excluded: it has its own always-visible box, so counting it would
 * badge a filter the user can already see.
 */
export function activeFilterCount(f: ProductFilters): number {
  return (
    (f.categories.length > 0 ? 1 : 0) +
    (f.supplierId !== null ? 1 : 0) +
    (f.stockStatus !== 'all' ? 1 : 0) +
    (f.minPrice !== null || f.maxPrice !== null ? 1 : 0) +
    (f.missingPriceOnly ? 1 : 0)
  )
}

function matchesStock(product: ProductWithStock, status: StockStatus): boolean {
  switch (status) {
    case 'in': return product.qtyOnHand > 0
    case 'out': return product.qtyOnHand === 0
    case 'oversold': return product.qtyOnHand < 0
    // Deliberately isLowStock, not a second copy of the rule: a reorder point
    // of 0 means "not tracked" (see stockLedger.ts), and this filter has to
    // agree with the banner and the row badge about what "low" means.
    case 'low': return isLowStock(product)
    case 'all': return true
  }
}

/**
 * What the search box looks at. Exported because the register's product
 * picker (src/components/workOrders/CheckoutCatalog.tsx) searches the same
 * catalog — typing a part number should find the same tile there as here.
 *
 * `query` must already be trimmed and lowercased by the caller, which both
 * callers do once per keystroke rather than once per product.
 */
export function matchesQuery(
  product: { name: string; sku: string; supplierCode: string },
  query: string
): boolean {
  return (
    product.name.toLowerCase().includes(query) ||
    product.sku.toLowerCase().includes(query) ||
    (product.supplierCode ?? '').toLowerCase().includes(query)
  )
}

/** Every filter applied together — all conditions must hold. */
export function filterProducts(products: ProductWithStock[], f: ProductFilters): ProductWithStock[] {
  const query = f.search.trim().toLowerCase()
  const categories = f.categories.length > 0 ? new Set(f.categories) : null

  return products.filter((p) => {
    // Supplier code included so a part number read off the box or a vendor's
    // order sheet finds the product, which is the whole point of storing it.
    if (query && !matchesQuery(p, query)) return false
    if (categories && !categories.has(p.category)) return false
    if (f.supplierId !== null && (p.supplierId ?? '') !== f.supplierId) return false
    if (!matchesStock(p, f.stockStatus)) return false
    if (f.missingPriceOnly && p.sellPrice > 0) return false
    if (f.minPrice !== null && p.sellPrice < f.minPrice) return false
    if (f.maxPrice !== null && p.sellPrice > f.maxPrice) return false
    return true
  })
}

// --- sorting --------------------------------------------------------------

export type SortKey = 'name' | 'sku' | 'supplierCode' | 'category' | 'cost' | 'price' | 'stock' | 'supplier'
export type SortDirection = 'asc' | 'desc'

export interface SortState {
  key: SortKey
  direction: SortDirection
}

/** Alphabetical by name — the only ordering that means anything in a catalog
 *  of hundreds of imported rows (insertion order is the CSV's, not the shop's). */
export const DEFAULT_SORT: SortState = { key: 'name', direction: 'asc' }

/** Money and quantity columns; everything else compares as text. */
const NUMERIC_KEYS: ReadonlySet<SortKey> = new Set<SortKey>(['cost', 'price', 'stock'])

/**
 * What clicking a column header does next.
 *
 * Clicking the column that's already sorting flips it. Clicking a new one
 * starts numeric columns **descending** — "sort by price" almost always means
 * "show me the expensive ones", and making that the second click would be a
 * worse answer to the only reason anyone clicks Price.
 */
export function nextSortState(current: SortState, key: SortKey): SortState {
  if (current.key === key) {
    return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
  }
  return { key, direction: NUMERIC_KEYS.has(key) ? 'desc' : 'asc' }
}

/** Cost and supplier name aren't stored on the product — the page derives both. */
export interface SortDerivations {
  costOf: (product: ProductWithStock) => number
  supplierNameOf: (product: ProductWithStock) => string
}

function compareText(a: string, b: string): number {
  return a.localeCompare(b, 'id', { numeric: true, sensitivity: 'base' })
}

/**
 * Ordered copy — never sorts the caller's array in place, which would mutate
 * the store's own products array.
 *
 * Ties break on name so the order is stable: without it, the hundreds of
 * imported products that share a price (or all sit at 0) would shuffle on
 * every re-render.
 */
export function sortProducts(
  products: ProductWithStock[],
  sort: SortState,
  derive: SortDerivations
): ProductWithStock[] {
  const sign = sort.direction === 'asc' ? 1 : -1

  const compare = (a: ProductWithStock, b: ProductWithStock): number => {
    switch (sort.key) {
      case 'name': return compareText(a.name, b.name)
      case 'sku': return compareText(a.sku, b.sku)
      case 'supplierCode': return compareText(a.supplierCode ?? '', b.supplierCode ?? '')
      case 'category': return compareText(a.category, b.category)
      case 'supplier': return compareText(derive.supplierNameOf(a), derive.supplierNameOf(b))
      case 'cost': return derive.costOf(a) - derive.costOf(b)
      case 'price': return a.sellPrice - b.sellPrice
      case 'stock': return a.qtyOnHand - b.qtyOnHand
    }
  }

  return [...products].sort((a, b) => {
    const result = compare(a, b)
    // Tiebreak stays ascending-by-name whichever way the column runs, so
    // flipping direction doesn't also reverse equal rows among themselves.
    return result !== 0 ? sign * result : compareText(a.name, b.name)
  })
}
