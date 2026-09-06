// Reading a labor price list into the services catalog — the Services
// counterpart to src/lib/productImport.ts, mirroring its shape deliberately
// so the two importers can't quietly drift on what "matches an existing
// row" or "what's new" means. Pure — no stores, no DOM: the caller reads the
// file text and passes its own service/item-type lists in. Applying the
// result is src/lib/ops/serviceCatalogOps.ts's applyServiceImport.
//
// Header-driven, same reasoning as products: a shop's next sheet is rarely
// the same shape as the last one, so columns are matched by name and
// everything unknown is ignored.
import type { ServiceCatalogItem } from '../store/serviceCatalogStore'
import { parseCsv, parseIdrAmount } from './productImport'

/** One parsed CSV line, already coerced to the fields it maps to. */
export interface ServiceImportRow {
  /** 1-based line number in the source file, for error messages. */
  line: number
  name: string
  price: number
  /** Schedule tag *name* as written in the file — resolved to a
   *  ServiceItemType id when planned. Blank means "no schedule tag", same as
   *  ServiceFormDialog's NO_SCHEDULE_TAG. */
  scheduleTag: string
  intervalKm: number | null
  intervalMonths: number | null
  notes: string
}

/** A ServiceImportRow with its schedule tag name resolved against the
 *  shop's item types. */
export interface PlannedService extends ServiceImportRow {
  serviceItemTypeId: string | null
}

export interface ServiceImportError {
  line: number
  message: string
}

/** A tag that would end up with more than one interval-carrying service
 *  after this import — not an error, since the app explicitly supports
 *  several candidates under one tag (e.g. manual vs. automatic transmission
 *  oil — see src/components/vehicles/NewVehicleScheduleFields.tsx), but
 *  worth surfacing: src/lib/serviceCatalog.ts's resolveDefaultCatalogMatch
 *  refuses to auto-fill a tag the moment it has more than one, so this is
 *  the FYI that would otherwise be a silent side effect of the import. */
export interface TagWithMultipleCandidates {
  tagName: string
  serviceNames: string[]
}

export interface ServiceImportPlan {
  /** Services that don't exist yet — created as-is. */
  create: PlannedService[]
  /** Existing services whose price the file disagrees with. */
  updatePrice: { service: ServiceCatalogItem; from: number; to: number }[]
  /** Existing services the file matches already. */
  unchanged: number
  /** Schedule tag names the file uses that the shop doesn't have yet. */
  newItemTypes: string[]
  /** Rows dropped because an earlier row in the same file claimed the name. */
  duplicatesInFile: ServiceImportRow[]
  /** FYI only — see TagWithMultipleCandidates. */
  multipleCandidateTags: TagWithMultipleCandidates[]
  errors: ServiceImportError[]
}

// --- CSV --------------------------------------------------------------

const COLUMNS = ['name', 'price', 'scheduletag', 'intervalkm', 'intervalmonths', 'notes'] as const
type ColumnName = (typeof COLUMNS)[number]

/** "Schedule Tag" / "schedule_tag" / "scheduleTag" all address the same column. */
function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[\s_-]/g, '')
}

/** Blank/junk is "no interval" (null), never 0 — a 0 km/month interval is
 *  meaningless, and blank must stay distinguishable from a real number, same
 *  convention as src/lib/serviceCatalog.ts's catalogDraftIntervals. */
function parseIntervalOrNull(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const n = parseInt(trimmed.replace(/[^\d]/g, ''), 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

export interface ServiceParseResult {
  rows: ServiceImportRow[]
  errors: ServiceImportError[]
}

/**
 * Parse a services CSV's text into rows. `name` is the only required
 * column; anything else falls back to the same defaults a blank Add Service
 * form would use (price '0', no tag, no interval).
 */
export function parseServiceCsv(text: string): ServiceParseResult {
  // fallow-ignore-next-line code-duplication -- deliberate mirror of productImport.ts's parseProductCsv, see this file's header
  const table = parseCsv(text)
  const errors: ServiceImportError[] = []
  if (table.length === 0) return { rows: [], errors: [{ line: 0, message: 'File is empty' }] }

  const headers = table[0].map(normalizeHeader)
  const index = {} as Record<ColumnName, number>
  for (const col of COLUMNS) index[col] = headers.indexOf(col)

  if (index.name < 0) {
    return { rows: [], errors: [{ line: 1, message: 'No "name" column found' }] }
  }

  const rows: ServiceImportRow[] = []
  for (let i = 1; i < table.length; i++) {
    const fields = table[i]
    const line = i + 1
    const at = (col: ColumnName) => (index[col] >= 0 ? (fields[index[col]] ?? '').trim() : '')

    const name = at('name')
    if (!name) { errors.push({ line, message: 'Row has no service name' }); continue }

    rows.push({
      line,
      name,
      price: parseIdrAmount(at('price')),
      scheduleTag: at('scheduletag'),
      intervalKm: parseIntervalOrNull(at('intervalkm')),
      intervalMonths: parseIntervalOrNull(at('intervalmonths')),
      notes: at('notes'),
    })
  }

  return { rows, errors }
}

// --- plan ---------------------------------------------------------------

function normalizeServiceName(name: string): string {
  return name.trim().toLowerCase()
}

/** What matching an existing service resolves to: a price-update row, or
 *  null for "unchanged" — a blank/zero price in the file means "not
 *  quoted," never "now free," never overwriting a real price. Mirrors
 *  productImport.ts's planExistingProduct exactly; a matched row never
 *  touches the tag, interval or notes — those are decisions a spreadsheet
 *  shouldn't make for an existing entry (and for a built-in service, the
 *  name is locked anyway; see entities.ts's isBuiltinServiceCatalogItem). */
function planExistingService(
  existing: ServiceCatalogItem,
  row: ServiceImportRow
): { service: ServiceCatalogItem; from: number; to: number } | null {
  if (row.price > 0 && row.price !== existing.price) {
    return { service: existing, from: existing.price, to: row.price }
  }
  return null
}

/** Resolve a row's free-text schedule tag to an id, creating it if the shop
 *  doesn't have it yet — unlike productImport.ts's supplier resolution
 *  (never created), a schedule tag IS created from the file, the same way
 *  a new product category is: an interval with no tag to carry it would
 *  never reach the schedule engine at all, defeating the reason to import
 *  intervals in the first place. Mutates `knownItemTypes` when it creates
 *  one, so the same new name isn't reported twice from one file. */
function resolveScheduleTag(
  row: ServiceImportRow,
  itemTypeIdByName: Map<string, string>,
  knownItemTypes: Set<string>,
  newItemTypes: string[]
): string | null {
  const tagName = row.scheduleTag.trim()
  if (!tagName) return null

  const key = tagName.toLowerCase()
  const existingId = itemTypeIdByName.get(key)
  if (existingId) return existingId

  if (!knownItemTypes.has(key)) {
    knownItemTypes.add(key)
    newItemTypes.push(tagName)
  }
  // No real id yet — the tag is created by applyServiceImport before the
  // services that reference it, same two-phase order as new product
  // categories (see productCatalogOps.ts). The placeholder is resolved
  // there by name at apply time; see that module's doc.
  return null
}

/**
 * Work out what importing these rows would do, without doing any of it.
 *
 * A row matches an existing service by name (case/whitespace-insensitive,
 * same normalization productImport.ts uses for products). Matched rows only
 * ever offer a *price* update — re-tagging or re-scheduling a service the
 * shop already sells isn't something a spreadsheet should decide, and a
 * built-in service's name can't be re-typed anyway (see entities.ts).
 *
 * Importing the same file twice is a no-op — everything lands in `unchanged`.
 */
export function planServiceImport(
  rows: ServiceImportRow[],
  services: ServiceCatalogItem[],
  existingItemTypes: { id: string; name: string }[] = []
): ServiceImportPlan {
  const byName = new Map(services.map((s) => [normalizeServiceName(s.name), s]))
  const itemTypeIdByName = new Map(existingItemTypes.map((it) => [it.name.trim().toLowerCase(), it.id]))
  const knownItemTypes = new Set(existingItemTypes.map((it) => it.name.trim().toLowerCase()))
  const seen = new Set<string>()

  const plan: ServiceImportPlan = {
    create: [], updatePrice: [], unchanged: 0,
    newItemTypes: [], duplicatesInFile: [], multipleCandidateTags: [], errors: [],
  }

  for (const row of rows) {
    // fallow-ignore-next-line code-duplication -- deliberate mirror of productImport.ts's planProductImport, see this file's header
    const key = normalizeServiceName(row.name)
    if (seen.has(key)) { plan.duplicatesInFile.push(row); continue }
    seen.add(key)

    const existing = byName.get(key)
    if (existing) {
      const update = planExistingService(existing, row)
      if (update) plan.updatePrice.push(update)
      else plan.unchanged++
      continue
    }

    const serviceItemTypeId = resolveScheduleTag(row, itemTypeIdByName, knownItemTypes, plan.newItemTypes)
    plan.create.push({ ...row, serviceItemTypeId })
  }

  plan.multipleCandidateTags = findMultipleCandidateTags(plan.create, services, existingItemTypes)

  return plan
}

/** Every tag name that would carry more than one interval-having service
 *  once `create` lands — existing interval-carrying services under a tag
 *  the file also targets, plus however many of the file's own create rows
 *  share that tag. A brand-new tag (no id yet) is grouped by name instead of
 *  id, since resolveScheduleTag leaves those rows with serviceItemTypeId:
 *  null pending creation. */
function findMultipleCandidateTags(
  create: PlannedService[],
  existingServices: ServiceCatalogItem[],
  existingItemTypes: { id: string; name: string }[]
): TagWithMultipleCandidates[] {
  const nameById = new Map(existingItemTypes.map((it) => [it.id, it.name]))
  const carriers = new Map<string, string[]>() // tag name -> service names

  const hasInterval = (s: { intervalKm?: number | null; intervalMonths?: number | null } | ServiceImportRow) =>
    !!s.intervalKm || !!s.intervalMonths

  for (const s of existingServices) {
    if (!s.serviceItemTypeId || !hasInterval(s)) continue
    const tagName = nameById.get(s.serviceItemTypeId)
    if (!tagName) continue
    carriers.set(tagName, [...(carriers.get(tagName) ?? []), s.name])
  }

  for (const row of create) {
    if (!hasInterval(row)) continue
    // A resolved id names an existing tag; an unresolved (new) tag is
    // grouped by its own typed name instead.
    const tagName = row.serviceItemTypeId ? nameById.get(row.serviceItemTypeId) : row.scheduleTag.trim()
    if (!tagName) continue
    carriers.set(tagName, [...(carriers.get(tagName) ?? []), row.name])
  }

  return [...carriers.entries()]
    .filter(([, names]) => names.length > 1)
    .map(([tagName, serviceNames]) => ({ tagName, serviceNames }))
}

/** Nothing to do — the preview says so instead of offering an Import button. */
export function isEmptyServicePlan(plan: ServiceImportPlan): boolean {
  return plan.create.length === 0 && plan.updatePrice.length === 0
}
