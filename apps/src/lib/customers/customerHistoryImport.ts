// Reading the shop's pre-app service history into customers, vehicles and
// completed work orders. Pure — no stores, no DOM: the caller reads the file
// and passes in the names/plates the shop already has, same shape as
// productImport.ts. Applying the plan is
// src/lib/ops/customerHistoryImportOps.ts.
//
// The input is the CSV scripts/convert-pelanggan-xlsx.mjs writes from the old
// one-file-per-customer Excel logs: one row per line item, owner and visit
// columns repeated on every row. The shop reviews (and may edit) it in Excel
// before importing, which is why the reader is forgiving about what Excel does
// on a save — ';' instead of ',' and "8,5" instead of "8.5" on an
// Indonesian-locale Windows — and why nothing here re-derives a value the file
// already states: if the shop corrected a line_total by hand, that's the total.
import { parseIdrAmount, readCsvTable, type ImportError } from '../format/csvTable'
import { formatPlate, plateKey } from '../vehicles/vehicleIdentity'
import { lineTotal } from '../orders/orderTotals'
import { translate } from '../i18n'

export type OwnerType = 'customer' | 'company'

/** One CSV row, coerced. */
export interface HistoryRow {
  /** 1-based line number in the file, for error messages. */
  line: number
  sourceFile: string
  ownerType: OwnerType
  ownerName: string
  phone: string
  plate: string
  vehicle: string
  visitNo: string
  /** As written — YYYY-MM-DD when the converter could read it, raw otherwise. */
  visitDate: string
  km: number | null
  visitNote: string
  section: string
  item: string
  qty: number | null
  unit: string
  unitPrice: number | null
  lineTotal: number | null
  note: string
  needsReview: boolean
}

export interface PlannedLine {
  description: string
  quantity: number
  unitPrice: number
  lineTotal: number
  /** Set for lines sold by the litre, so the order's fluid quantities read right. */
  quantityLiters: number | null
  kind: 'product' | 'service'
}

export interface PlannedVisit {
  /** YYYY-MM-DD — the visit's own date, or the previous visit's when it had none (see `dateEstimated`). */
  date: string
  dateEstimated: boolean
  km: number | null
  notes: string
  lines: PlannedLine[]
  total: number
}

export interface PlannedVehicle {
  /** Set when the app already has a vehicle with this plate: visits attach to it and nothing new is created. */
  existingVehicleId: string | null
  /** As the app stores it; '' when the log never recorded one. */
  plate: string
  make: string
  currentMileage: number | null
  oilTypeRequired: string
  differentialFluidType: string
  transmissionFluidType: string
  visits: PlannedVisit[]
}

export interface PlannedOwner {
  ownerType: OwnerType
  name: string
  phone: string
  sourceFile: string
  vehicles: PlannedVehicle[]
}

export interface CustomerHistoryPlan {
  create: PlannedOwner[]
  /** Owners whose name the shop already has — skipped whole, which is what makes a second import a no-op. */
  skippedOwners: string[]
  /** Plates the app already has: their visits attach to the existing vehicle instead of a new one. */
  attachedToExisting: string[]
  /** Plates logged under more than one file — one vehicle, owned by whoever's file has the latest visit. */
  sharedPlates: string[]
  /** Rows the converter flagged and nobody cleared — imported as written. */
  rowsNeedingReview: number
  /** Visits with no readable date, dated from the visit before them. */
  datesEstimated: number
  errors: ImportError[]
}

// --- parse ------------------------------------------------------------------

const COLUMNS = [
  'source_file', 'owner_type', 'owner_name', 'phone', 'plate', 'vehicle', 'visit_no', 'visit_date',
  'km', 'visit_note', 'section', 'item', 'qty', 'unit', 'unit_price', 'line_total', 'note',
  'needs_review',
] as const

/** A quantity as Excel may have saved it: "8.5", "8,5". */
function parseQuantity(raw: string): number | null {
  const s = raw.trim().replace(',', '.')
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) && n > 0 ? n : null
}

function parseAmountOrNull(raw: string): number | null {
  return raw.trim() ? parseIdrAmount(raw) : null
}

/** Owner names compare trimmed, case- and spacing-insensitive. */
export function ownerKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
}

export function parseCustomerHistoryCsv(text: string): { rows: HistoryRow[]; errors: ImportError[] } {
  const table = readCsvTable(text, COLUMNS, {
    required: 'owner_name',
    delimiter: 'auto',
    missingRequired: translate('importErrors.historyMissingOwnerColumn'),
  })
  if (!table.ok) return { rows: [], errors: [table.error] }

  const rows: HistoryRow[] = []
  const errors: ImportError[] = []
  for (const { line, at } of table.rows) {
    const ownerName = at('owner_name')
    if (!ownerName) { errors.push({ line, message: translate('importErrors.rowNoOwnerName') }); continue }

    rows.push({
      line,
      sourceFile: at('source_file'),
      ownerType: at('owner_type').toLowerCase() === 'company' ? 'company' : 'customer',
      ownerName,
      phone: at('phone'),
      plate: at('plate').toUpperCase().replace(/\s+/g, ' '),
      vehicle: at('vehicle'),
      visitNo: at('visit_no'),
      visitDate: at('visit_date'),
      km: parseAmountOrNull(at('km')),
      visitNote: at('visit_note'),
      section: at('section'),
      item: at('item'),
      qty: parseQuantity(at('qty')),
      unit: at('unit'),
      unitPrice: parseAmountOrNull(at('unit_price')),
      lineTotal: parseAmountOrNull(at('line_total')),
      note: at('note'),
      needsReview: /^(yes|ya|y|true|1)$/i.test(at('needs_review')),
    })
  }
  return { rows, errors }
}

// --- plan -------------------------------------------------------------------

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

// Oil names like "HDA90" don't say which fluid they were; the converter's
// section does.
const SECTION_SUFFIX = new Set(['Gardan', 'Transmisi'])

function toPlannedLine(row: HistoryRow): PlannedLine {
  const quantity = row.qty ?? 1
  const unitPrice = row.unitPrice ?? 0
  const total = row.lineTotal ?? lineTotal(quantity, unitPrice)
  let description = row.item || row.section
  if (SECTION_SUFFIX.has(row.section) && row.item !== row.section) description += ` (${row.section})`
  const extras = [row.unit && row.qty != null ? `${row.qty} ${row.unit}` : '', row.note]
  if (row.unitPrice == null && row.lineTotal == null) extras.push('harga tidak tercatat')
  const extra = extras.filter(Boolean).join('; ')
  if (extra) description += ` — ${extra}`
  return {
    description,
    quantity,
    unitPrice,
    lineTotal: total,
    quantityLiters: /^l(t|tr|iter)?$/i.test(row.unit) ? quantity : null,
    kind: /^(jasa|service|servis|ongkos)\b/i.test(row.item) ? 'service' : 'product',
  }
}

/** The last non-empty value, walking visits oldest → newest. */
function latest<T>(values: (T | null | undefined | '')[]): T | '' {
  for (let i = values.length - 1; i >= 0; i--) {
    const v = values[i]
    if (v != null && v !== '') return v
  }
  return ''
}


interface VisitDraft {
  key: string
  plate: string
  rawDate: string
  km: number | null
  notes: string
  vehicle: string
  rows: HistoryRow[]
}

interface OwnerDraft {
  head: HistoryRow
  /** plateKey → visits ('' = visits with no plate recorded) */
  vehicles: Map<string, Map<string, VisitDraft>>
}

/**
 * A visit with an unreadable date ("8/8/204") takes the date of the visit
 * logged before it in the same file — the logs are written in order, so
 * that's the closest date the file can vouch for. Done per file across all
 * its vehicles, in file order (visit numbers ascend down the sheet); a
 * leading undated visit borrows the first good date after it.
 */
function resolveDates(owner: OwnerDraft, into: Map<VisitDraft, { date: string; estimated: boolean }>): void {
  const allVisits = [...owner.vehicles.values()].flatMap((v) => [...v.values()])
    .sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }))
  let lastGood = ''
  const firstGood = allVisits.find((v) => ISO_DATE.test(v.rawDate))?.rawDate ?? ''
  for (const v of allVisits) {
    if (ISO_DATE.test(v.rawDate)) { lastGood = v.rawDate; into.set(v, { date: v.rawDate, estimated: false }) }
    else into.set(v, { date: lastGood || firstGood, estimated: true })
  }
}

/**
 * Work out what importing these rows would create, without creating any of
 * it. Grouping: owner (one per source file) → vehicle (by plate) → visit (by
 * source file + visit number) → lines. A row with no item is a visit with
 * nothing priced on it, or an owner with no visits at all — both still
 * create what they name.
 *
 * One vehicle per plate (src/lib/vehicles/vehicleIdentity.ts):
 * - The same plate logged under two files becomes ONE vehicle, owned by
 *   whoever's file has its latest visit — that's who the car belongs to now —
 *   carrying every visit from every file. The other owner is still created.
 * - A plate the app already has gets its visits attached to that existing
 *   vehicle, whose owner is left alone, instead of a second row.
 *
 * Idempotent: an owner whose name already exists — as a customer OR a
 * company — is skipped together with everything under it, so importing the
 * same file twice creates nothing the second time.
 */
export function planCustomerHistoryImport(
  rows: HistoryRow[],
  existing: { ownerNames: string[]; vehicles: { id: string; licensePlate: string }[] }
): CustomerHistoryPlan {
  const existingOwners = new Set(existing.ownerNames.map(ownerKey))

  const plan: CustomerHistoryPlan = {
    create: [], skippedOwners: [], attachedToExisting: [], sharedPlates: [],
    rowsNeedingReview: 0, datesEstimated: 0, errors: [],
  }

  // 1. Group. Insertion-ordered maps keep owners, vehicles and visits in file order.
  const owners = new Map<string, OwnerDraft>()
  for (const row of rows) {
    const oKey = ownerKey(row.ownerName)
    if (existingOwners.has(oKey)) {
      if (!plan.skippedOwners.includes(row.ownerName)) plan.skippedOwners.push(row.ownerName)
      continue
    }
    if (row.needsReview) plan.rowsNeedingReview++

    // One owner per source file, not per name: "ANTO.xlsx" and "ANTO
    // 081200001111.xlsx" both read as ANTO once the phone is split off, and
    // nothing in the file says they're the same person.
    const fileKey = row.sourceFile || oKey
    let owner = owners.get(fileKey)
    if (!owner) { owner = { head: row, vehicles: new Map() }; owners.set(fileKey, owner) }
    // An owner-only row (customer with no visits) carries no visit number.
    if (!row.visitNo && !row.visitDate && !row.item) continue

    const vKey = plateKey(row.plate)
    let visits = owner.vehicles.get(vKey)
    if (!visits) { visits = new Map(); owner.vehicles.set(vKey, visits) }
    const visitKey = `${row.sourceFile}#${row.visitNo}`
    let visit = visits.get(visitKey)
    if (!visit) {
      visit = { key: visitKey, plate: row.plate, rawDate: row.visitDate, km: row.km, notes: row.visitNote, vehicle: row.vehicle, rows: [] }
      visits.set(visitKey, visit)
    }
    if (row.item || row.unitPrice != null || row.lineTotal != null) visit.rows.push(row)
  }

  // 2. Dates, per file — before plates move between owners, since a file's
  //    own sequence is what an unreadable date is estimated from.
  const resolvedDate = new Map<VisitDraft, { date: string; estimated: boolean }>()
  for (const owner of owners.values()) resolveDates(owner, resolvedDate)

  // 3. A plate under several files goes to the file with its latest visit.
  const lastSeen = (visits: Map<string, VisitDraft>) =>
    [...visits.values()].reduce((max, d) => {
      const date = resolvedDate.get(d)!.date
      return date > max ? date : max
    }, '')
  const holders = new Map<string, OwnerDraft[]>()
  for (const owner of owners.values()) {
    for (const vKey of owner.vehicles.keys()) {
      if (!vKey) continue
      const list = holders.get(vKey)
      if (list) list.push(owner)
      else holders.set(vKey, [owner])
    }
  }
  for (const [vKey, list] of holders) {
    if (list.length < 2) continue
    const winner = list.reduce((best, o) => (lastSeen(o.vehicles.get(vKey)!) > lastSeen(best.vehicles.get(vKey)!) ? o : best))
    const into = winner.vehicles.get(vKey)!
    for (const o of list) {
      if (o === winner) continue
      for (const [k, d] of o.vehicles.get(vKey)!) into.set(k, d)
      o.vehicles.delete(vKey)
    }
    plan.sharedPlates.push(into.values().next().value!.plate)
  }

  // 4. Build.
  const existingByKey = new Map(existing.vehicles.map((v) => [plateKey(v.licensePlate), v.id] as const).filter(([k]) => k))
  for (const { head, vehicles } of owners.values()) {
    const plannedVehicles: PlannedVehicle[] = []
    for (const [vKey, visitMap] of vehicles) {
      const drafts = [...visitMap.values()]
      const visits: PlannedVisit[] = []
      for (const d of drafts) {
        const { date, estimated } = resolvedDate.get(d)!
        if (!date) {
          plan.errors.push({ line: d.rows[0]?.line ?? head.line, message: translate('importErrors.visitNoDate', { owner: head.ownerName }) })
          continue
        }
        if (estimated) plan.datesEstimated++
        const lines = d.rows.map(toPlannedLine)
        const notes = [
          `Impor Excel: ${d.key.replace('#', ' no. ')}`,
          estimated && d.rawDate ? `tanggal asli: ${d.rawDate}` : estimated ? 'tanggal tidak tercatat' : '',
          d.notes,
        ].filter(Boolean).join('; ')
        visits.push({ date, dateEstimated: estimated, km: d.km, notes, lines, total: lines.reduce((s, l) => s + l.lineTotal, 0) })
      }
      visits.sort((a, b) => a.date.localeCompare(b.date))

      const oldestFirst = drafts.slice().sort((a, b) => resolvedDate.get(a)!.date.localeCompare(resolvedDate.get(b)!.date))
      const rowsOldestFirst = oldestFirst.flatMap((d) => d.rows)
      const fluid = (section: string) => latest(rowsOldestFirst.filter((r) => r.section === section).map((r) => r.item))
      const kms = visits.map((v) => v.km).filter((k): k is number => k != null)
      // The newest spelling of the plate, in the app's stored form.
      const plate = formatPlate(latest(oldestFirst.map((d) => d.plate)))
      const existingVehicleId = (vKey && existingByKey.get(vKey)) || null
      if (existingVehicleId) plan.attachedToExisting.push(plate)

      plannedVehicles.push({
        existingVehicleId,
        plate,
        make: latest(oldestFirst.map((d) => d.vehicle)),
        currentMileage: kms.length ? Math.max(...kms) : null,
        oilTypeRequired: fluid('Mesin'),
        differentialFluidType: fluid('Gardan'),
        transmissionFluidType: fluid('Transmisi'),
        visits,
      })
    }

    plan.create.push({
      ownerType: head.ownerType,
      name: head.ownerName,
      phone: head.phone,
      sourceFile: head.sourceFile,
      vehicles: plannedVehicles,
    })
  }

  return plan
}

export function planTotals(plan: CustomerHistoryPlan) {
  const vehicles = plan.create.flatMap((o) => o.vehicles)
  const visits = vehicles.flatMap((v) => v.visits)
  return {
    customers: plan.create.filter((o) => o.ownerType === 'customer').length,
    companies: plan.create.filter((o) => o.ownerType === 'company').length,
    /** New vehicles only — visits on a plate the app already has attach to that vehicle. */
    vehicles: vehicles.filter((v) => !v.existingVehicleId).length,
    orders: visits.length,
    revenue: visits.reduce((s, v) => s + v.total, 0),
  }
}

export function isEmptyHistoryPlan(plan: CustomerHistoryPlan): boolean {
  return plan.create.length === 0
}
