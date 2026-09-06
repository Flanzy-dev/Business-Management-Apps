// Reading a supplier/distributor price list into the product catalog. Pure —
// no stores, no DOM: the caller reads the file text and passes its own product
// list in, the same shape as stockLedger.ts and inventoryCosting.ts. Applying
// the result is src/lib/ops/inventoryOps.ts's applyProductImport.
//
// Header-driven on purpose. A shop's next price list is rarely the same shape
// as the last one, so columns are matched by name and everything unknown is
// ignored: the full catalog export works, and so does a two-column
// "name,sellPrice" sheet that only refreshes prices.
import type { Product } from '../store/inventoryStore'
import { normalizeProductName, normalizeSupplierCode } from './productIdentity'

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

export interface ImportError {
  line: number
  message: string
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

/**
 * Split CSV text into rows of fields (RFC4180: quoted fields may contain
 * commas, newlines and doubled quotes). Written out rather than pulled from a
 * dependency — the app ships offline and this is the only CSV it reads.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  // Strip a UTF-8 BOM: Excel writes one, and it would otherwise become part of
  // the first header name and stop "name" from matching.
  const src = text.replace(/^﻿/, '')

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++ } else inQuotes = false
      } else field += ch
      continue
    }
    if (ch === '"') { inQuotes = true; continue }
    if (ch === ',') { row.push(field); field = ''; continue }
    if (ch === '\r') continue
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue }
    field += ch
  }
  row.push(field)
  rows.push(row)

  // Trailing newline leaves one empty row; blank lines mid-file are skipped too.
  return rows.filter((r) => r.some((f) => f.trim() !== ''))
}

/**
 * Whole Rupiah from however the price list wrote it: "6.500.000", "6,500,000"
 * and "6500000" are all 6500000. Separators are dropped rather than
 * interpreted — IDR has no minor unit in practice (see CLAUDE.md), so any
 * fractional part is noise, and guessing which of "." and "," meant a decimal
 * point would be the one way to be wrong by a factor of a thousand.
 */
export function parseIdrAmount(raw: string): number {
  const digits = raw.replace(/[^\d]/g, '')
  if (!digits) return 0
  const n = parseInt(digits, 10)
  return Number.isFinite(n) ? n : 0
}

function parseCount(raw: string): number {
  const n = parseInt(raw.replace(/[^\d-]/g, ''), 10)
  return Number.isFinite(n) ? Math.max(0, n) : 0
}

// 'suppliercode' is matched exactly, so it can't be confused with 'supplier'
// — normalizeHeader only strips spaces/underscores/dashes, it doesn't prefix-match.
const COLUMNS = [
  'name', 'sku', 'suppliercode', 'category', 'unit', 'costprice', 'sellprice', 'reorderpoint',
  'notes', 'supplier',
] as const
type ColumnName = (typeof COLUMNS)[number]

/** "Sell Price" / "sell_price" / "sellPrice" all address the same column. */
function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[\s_-]/g, '')
}

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
  // fallow-ignore-next-line code-duplication -- deliberate mirror of serviceImport.ts's parseServiceCsv, see that file's header
  const table = parseCsv(text)
  const errors: ImportError[] = []
  if (table.length === 0) return { rows: [], errors: [{ line: 0, message: 'File is empty' }] }

  const headers = table[0].map(normalizeHeader)
  const index = {} as Record<ColumnName, number>
  for (const col of COLUMNS) index[col] = headers.indexOf(col)

  if (index.name < 0) {
    return { rows: [], errors: [{ line: 1, message: 'No "name" column found' }] }
  }

  const rows: ImportRow[] = []
  for (let i = 1; i < table.length; i++) {
    const fields = table[i]
    const line = i + 1
    const at = (col: ColumnName) => (index[col] >= 0 ? (fields[index[col]] ?? '').trim() : '')

    const name = at('name')
    if (!name) { errors.push({ line, message: 'Row has no product name' }); continue }

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
    error: supplierId === null ? { line: row.line, message: `Unknown supplier "${supplierName}" — imported without one` } : null,
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
 * src/lib/productIdentity.ts's findDuplicateProduct uses — so the importer and
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
    // fallow-ignore-next-line code-duplication -- deliberate mirror of serviceImport.ts's planServiceImport, see that file's header
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
