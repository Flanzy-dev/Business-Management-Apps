// Reading a supplier/distributor price list into the product catalog. Pure —
// no stores, no DOM: the caller reads the file text and passes its own product
// list in, the same shape as stockLedger.ts and inventoryCosting.ts. Applying
// the result is src/lib/ops/inventoryOps.ts's applyProductImport.
//
// Header-driven on purpose. A shop's next price list is rarely the same shape
// as the last one, so columns are matched by name and everything unknown is
// ignored: the full catalog export works, and so does a two-column
// "name,sellPrice" sheet that only refreshes prices.
import type { Product } from '../../store/inventoryStore'
import { normalizeProductName, normalizeSupplierCode } from './productIdentity'
import { parseIdrAmount, readCsvTable, type ImportError } from '../format/csvTable'
import { translate } from '../i18n'

export type { ImportError }

/** One parsed CSV line, already coerced to the Product fields it maps to. */
export interface ImportRow {
  /** 1-based line number in the source file, for error messages. */
  line: number
  name: string
  sku: string
  /** The supplier's part number, already uppercased to its stored form. */
  supplierCode: string
  category: string
  unit: string
  costPrice: number
  sellPrice: number
  reorderPoint: number
  notes: string
  /** Supplier *name* as written in the file — resolved to an id when planned. */
  supplier: string
}

/** An ImportRow with its supplier name looked up against the shop's suppliers. */
export interface PlannedProduct extends ImportRow {
  supplierId: string | null
}

export interface ImportPlan {
  /** Products that don't exist yet — created as-is. */
  create: PlannedProduct[]
  /** Existing products whose sell price the file disagrees with. */
  updatePrice: { product: Product; from: number; to: number }[]
  /** Existing products the file matches already. */
  unchanged: number
  /** Categories named by the file that the shop doesn't have yet. */
  newCategories: string[]
  /** Rows dropped because an earlier row in the same file claimed the name. */
  duplicatesInFile: ImportRow[]
  errors: ImportError[]
}

// --- CSV ------------------------------------------------------------------

function parseCount(raw: string): number {
  const n = parseInt(raw.replace(/[^\d-]/g, ''), 10)
  return Number.isFinite(n) ? Math.max(0, n) : 0
}

// 'suppliercode' is matched exactly, so it can't be confused with 'supplier'
// — csvTable.ts's normalizeHeader only strips spaces/underscores/dashes, it
// doesn't prefix-match.
const COLUMNS = [
  'name', 'sku', 'suppliercode', 'category', 'unit', 'costprice', 'sellprice', 'reorderpoint',
  'notes', 'supplier',
] as const

export interface ParseResult {
  rows: ImportRow[]
  errors: ImportError[]
}

/**
 * Parse price-list CSV text into rows. `name` is the only required column;
 * anything else falls back to the same defaults a blank Add Product form would
 * use. Unknown columns are ignored rather than rejected, so a file carrying the
 * shop's own extra notes still imports.
 */
export function parseProductCsv(text: string): ParseResult {
  const table = readCsvTable(text, COLUMNS, { required: 'name' })
  if (!table.ok) return { rows: [], errors: [table.error] }

  const rows: ImportRow[] = []
  const errors: ImportError[] = []
  for (const { line, at } of table.rows) {
    const name = at('name')
    if (!name) { errors.push({ line, message: translate('importErrors.rowNoProductName') }); continue }

    rows.push({
      line,
      name,
      sku: at('sku'),
      supplierCode: normalizeSupplierCode(at('suppliercode')),
      category: at('category'),
      unit: at('unit') || 'each',
      costPrice: parseIdrAmount(at('costprice')),
      sellPrice: parseIdrAmount(at('sellprice')),
      reorderPoint: parseCount(at('reorderpoint')),
      notes: at('notes'),
      supplier: at('supplier'),
    })
  }

  return { rows, errors }
}

// --- plan -----------------------------------------------------------------

/** What matching an existing product resolves to: a price-update row, or
 *  null for "unchanged" — a blank/zero price in the file means "not
 *  quoted," never "now free," so it never overwrites a real price. */
function planExistingProduct(
  existing: Product,
  row: ImportRow
): { product: Product; from: number; to: number } | null {
  if (row.sellPrice > 0 && row.sellPrice !== existing.sellPrice) {
    return { product: existing, from: existing.sellPrice, to: row.sellPrice }
  }
  return null
}

/**
 * Resolve a row's free-text supplier name to an id, plus an error line when
 * it's named but unrecognized. A supplier is never created from a
 * spreadsheet (see planProductImport's own doc comment) — an unnamed
 * supplier resolves to null with no error; a named-but-unknown one also
 * resolves to null, but is reported.
 */
function resolveSupplierId(
  row: ImportRow,
  supplierIdByName: Map<string, string>
): { supplierId: string | null; error: ImportError | null } {
  const supplierName = row.supplier.trim()
  if (!supplierName) return { supplierId: null, error: null }
  const supplierId = supplierIdByName.get(supplierName.toLowerCase()) ?? null
  return {
    supplierId,
    error: supplierId === null ? { line: row.line, message: translate('importErrors.unknownSupplier', { supplier: supplierName }) } : null,
  }
}

/**
 * A new-to-this-batch category name for a create row, or null when it names
 * none or one already seen. Mutates `knownCategories` when it returns a
 * name — the running "already reported" set the rest of the batch checks
 * against, so the same category isn't reported twice from one file.
 */
function recordNewCategory(row: ImportRow, knownCategories: Set<string>): string | null {
  const category = row.category.trim()
  if (!category || knownCategories.has(category.toLowerCase())) return null
  knownCategories.add(category.toLowerCase())
  return category
}

/**
 * Work out what importing these rows would do, without doing any of it.
 *
 * A row matches an existing product by name, using the same normalization
 * src/lib/inventory/productIdentity.ts's findDuplicateProduct uses — so the importer and
 * the Add Product form can never disagree about what "already exists" means.
 * Matched rows only ever offer a *price* update: re-categorizing or renaming a
 * product the shop has been selling isn't something a supplier's sheet should
 * decide.
 *
 * Importing the same file twice is a no-op — everything lands in `unchanged`.
 */
export function planProductImport(
  rows: ImportRow[],
  products: Product[],
  existingCategories: string[] = [],
  // Suppliers the shop already has, for resolving the export's `supplier`
  // name column back to an id. Unlike categories, a supplier is never created
  // from a spreadsheet: it carries contact details a price list doesn't have,
  // so an unknown name is reported and the product is left unlinked.
  existingSuppliers: { id: string; name: string }[] = []
): ImportPlan {
  const byName = new Map(products.map((p) => [normalizeProductName(p.name), p]))
  const knownCategories = new Set(existingCategories.map((c) => c.trim().toLowerCase()))
  const supplierIdByName = new Map(existingSuppliers.map((s) => [s.name.trim().toLowerCase(), s.id]))
  const seen = new Set<string>()

  const plan: ImportPlan = {
    create: [], updatePrice: [], unchanged: 0,
    newCategories: [], duplicatesInFile: [], errors: [],
  }

  for (const row of rows) {
    // Deliberately mirrors serviceImport.ts's planServiceImport — see that file's header.
    const key = normalizeProductName(row.name)
    if (seen.has(key)) { plan.duplicatesInFile.push(row); continue }
    seen.add(key)

    const existing = byName.get(key)
    if (existing) {
      const update = planExistingProduct(existing, row)
      if (update) plan.updatePrice.push(update)
      else plan.unchanged++
      continue
    }

    const { supplierId, error } = resolveSupplierId(row, supplierIdByName)
    if (error) plan.errors.push(error)

    // row.supplierCode passes straight through: these files carry the "modal"
    // code, which encodes what an item cost, so products bought at the same
    // price legitimately share one (see normalizeSupplierCode).
    plan.create.push({ ...row, supplierId })
    const category = recordNewCategory(row, knownCategories)
    if (category) plan.newCategories.push(category)
  }

  return plan
}

/** Nothing to do — the preview says so instead of offering an Import button. */
export function isEmptyPlan(plan: ImportPlan): boolean {
  return plan.create.length === 0 && plan.updatePrice.length === 0
}
