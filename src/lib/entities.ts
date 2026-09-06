// Shared entity-display helpers. Pure functions (no hooks) that take the store
// arrays explicitly, so the label/owner-resolution logic lives in one place
// instead of being re-implemented in every page. Callers keep thin one-line
// closures that bind their own store data to these.
import type { Vehicle } from '../store/vehicleStore'
import type { Customer } from '../store/customerStore'
import type { Company } from '../store/companyStore'
import type { Worker } from '../store/workerStore'
import { translate } from './i18n'
import { formatNumber, formatDistance } from './units'

/** "2021 Toyota Avanza" — vehicle year/make/model, no plate. */
export function vehicleLabel(v?: Vehicle | null): string {
  if (!v) return 'Unknown vehicle'
  return `${v.year || ''} ${v.make} ${v.model}`.trim()
}

/**
 * "2021 Toyota Avanza - B 1234 XYZ" — vehicle label with plate appended.
 * Takes just the fields it reads, not a full Vehicle, so a not-yet-saved
 * form draft (e.g. Vehicles.tsx's handleSave building an activity log label
 * before/without a stored row) can be passed directly.
 */
export function vehicleLabelWithPlate(
  v?: Pick<Vehicle, 'year' | 'make' | 'model' | 'licensePlate'> | null
): string {
  if (!v) return 'Unknown vehicle'
  return `${v.year || ''} ${v.make} ${v.model} - ${v.licensePlate}`.trim()
}

export interface VehicleSpecField {
  labelKey: string
  value: string
  /** How the value renders — the three styles Vehicles.tsx's/ServiceHistory
   *  .tsx's spec grids actually use: monospaced (VIN, plate), tabular
   *  digits (mileage), or plain inline text (everything else). */
  variant?: 'mono' | 'tabular' | 'plain'
}

export interface VehicleSpecGroup {
  headingKey: string
  fields: VehicleSpecField[]
}

/**
 * A vehicle's specs, grouped and pre-filtered to only the fields it actually
 * has — Vehicles.tsx's expanded row used to be 13 hand-written
 * `{field && <p>...}` branches across 4 groups; this is the same information
 * as one data structure a caller can `.map()` over, dropping an empty group
 * (or an empty field within one) instead of rendering nothing for it.
 */
function specField(labelKey: string, value: string | null | undefined, variant?: VehicleSpecField['variant']): VehicleSpecField | null {
  return value ? { labelKey, value, variant } : null
}

function specFields(...fields: (VehicleSpecField | null)[]): VehicleSpecField[] {
  return fields.filter((f): f is VehicleSpecField => f !== null)
}

export function vehicleSpecGroups(vehicle: Vehicle): VehicleSpecGroup[] {
  const groups: VehicleSpecGroup[] = [
    {
      headingKey: 'vehicles.basicInfoHeading',
      fields: specFields(
        specField('vehicles.vinLabel', vehicle.vin, 'mono'),
        specField('vehicles.plateLabel', vehicle.licensePlate, 'mono'),
        specField('vehicles.mileageLabel', vehicle.currentMileage != null ? formatDistance(vehicle.currentMileage) : null, 'tabular')
      ),
    },
    {
      headingKey: 'vehicles.engineHeading',
      fields: specFields(
        specField('vehicles.typeLabel', vehicle.engineType),
        specField('vehicles.sizeLabel', vehicle.engineSize),
        specField('vehicles.oilLabel', vehicle.oilTypeRequired),
        specField('vehicles.capacityLabel', vehicle.oilCapacity)
      ),
    },
    {
      headingKey: 'vehicles.transmissionHeading',
      fields: specFields(
        specField('vehicles.typeLabel', vehicle.transmissionType),
        specField('vehicles.fluidLabel', vehicle.transmissionFluidType)
      ),
    },
    {
      headingKey: 'vehicles.gardanHeading',
      fields: specFields(specField('vehicles.driveLabel', vehicle.driveType), specField('vehicles.fluidLabel', vehicle.differentialFluidType)),
    },
  ]
  // Groups shown even when empty in the original (Basic Info/Engine/
  // Transmission/Gardan headings always rendered) — only the *fields* inside
  // were individually gated. Preserved here: no group is dropped, callers
  // that want to hide an empty group can check `fields.length` themselves.
  return groups
}

/** Owning customer's name, else owning company's name, else "No owner". */
export function ownerName(
  v: Vehicle | null | undefined,
  customers: Customer[],
  companies: Company[],
): string {
  if (!v) return 'Unknown'
  if (v.customerId) return customers.find(c => c.id === v.customerId)?.name || 'Unknown'
  if (v.companyId) return companies.find(c => c.id === v.companyId)?.companyName || 'Unknown'
  return 'No owner'
}

/**
 * An appointment's owner label — Dashboard.tsx's own version of "who is
 * this for", distinct from ownerName above in two ways: it starts from the
 * appointment (which may carry a customerId/companyId directly, for a
 * walk-in with no vehicle on file yet, not just a vehicleId), and its
 * fallback text is translated (`appointments.unknownCustomer`/
 * `walkInOwner`) rather than ownerName's hardcoded "Unknown"/"No owner" —
 * this is shown as the actual label, not used as a match key the way
 * globalSearch.ts's rawOwnerName needs an untranslated one to be.
 */
export function appointmentOwnerName(
  a: { vehicleId: string | null; customerId?: string | null; companyId?: string | null },
  vehicleById: Map<string, Vehicle>,
  customers: Customer[],
  companies: Company[]
): string {
  if (a.vehicleId) return ownerName(vehicleById.get(a.vehicleId), customers, companies)
  if (a.customerId) return customers.find((c) => c.id === a.customerId)?.name ?? translate('appointments.unknownCustomer')
  if (a.companyId) return companies.find((c) => c.id === a.companyId)?.companyName ?? translate('appointments.unknownCustomer')
  return translate('appointments.walkInOwner')
}

/** The phone/email of whichever Customer or Company owns this vehicle, or null with no owner. */
export function ownerContact(
  v: Vehicle | null | undefined,
  customers: Customer[],
  companies: Company[],
): { phone: string; email: string } | null {
  if (!v) return null
  if (v.customerId) {
    const customer = customers.find(c => c.id === v.customerId)
    return customer ? { phone: customer.phone, email: customer.email } : null
  }
  if (v.companyId) {
    const company = companies.find(c => c.id === v.companyId)
    return company ? { phone: company.phone, email: company.email } : null
  }
  return null
}

/** Worker name, "-" when unassigned, "Unknown" when the id no longer resolves. */
export function workerName(workerId: string | null, workers: Worker[]): string {
  if (!workerId) return '-'
  return workers.find(w => w.id === workerId)?.name || 'Unknown'
}

/** License plate, "-" when absent. */
export function vehiclePlate(v?: Vehicle | null): string {
  return v?.licensePlate || '-'
}

const BUILTIN_CATEGORY_I18N_KEYS: Record<string, string> = {
  'Oli Mesin Diesel': 'categoryOliDiesel',
  'Oli Mesin Bensin': 'categoryOliBensin',
  'Oli Mesin Motor / Matic': 'categoryOliMotorMatic',
  'Oli Transmisi / Gardan': 'categoryOliTransmisiGardan',
  'Gemuk': 'categoryGemukGrease',
  'Pendingin & Minyak Rem': 'categoryCoolantBrakeFluid',
  'Additive / Pembersih': 'categoryChemicalAdditive',
  'Filter Oli': 'categoryFilterOli',
  'Filter Udara': 'categoryFilterUdara',
  'Filter Solar': 'categoryFilterSolar',
  'Filter Kabin': 'categoryFilterKabin',
  'Minyak Power Steering': 'categoryMinyakPowerSteering',
  'Oli Industri / Hidrolik': 'categoryOliIndustriHidrolik',
  'Oli Kompresor': 'categoryOliKompresor',
  'Busi': 'categoryBusi',
  'Aki & Kelistrikan': 'categoryAkiKelistrikan',
  'Sparepart & Aksesori': 'categorySparepartAksesori',
  'Perlengkapan Bengkel': 'categoryPerlengkapanBengkel',
}

/**
 * Translated label for a product category name. The seven seeded/built-in
 * categories are translated; a shop's own custom category (added via
 * Settings or inline from the product form) shows exactly as typed — there's
 * no way to auto-translate arbitrary shop-entered text.
 */
export function productCategoryLabel(name: string): string {
  const key = BUILTIN_CATEGORY_I18N_KEYS[name]
  return key ? translate(`inventory.${key}`) : name
}

/**
 * True when this category is one the app names and translates itself — the
 * same question productCategoryLabel answers internally, exposed so Settings
 * can show a built-in's translated name instead of the raw stored one and
 * keep it out of the rename field (typing over it would break the link above
 * for every language at once).
 */
export function isBuiltinProductCategory(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(BUILTIN_CATEGORY_I18N_KEYS, name)
}

const BUILTIN_SERVICE_ITEM_TYPE_I18N_KEYS: Record<string, string> = {
  'Oli Mesin': 'oliMesin',
  'Filter Oli': 'filterOli',
  'Oli Transmisi': 'oliTransmisi',
  'Oli Gardan': 'oliGardan',
  'Filter Solar': 'filterSolar',
  'Minyak Rem': 'minyakRem',
  'Minyak Power Steering': 'minyakPowerSteering',
}

/**
 * Translated label for a service item type name. The seven seeded/built-in
 * item types are translated; a shop's own custom item type (added via
 * Settings) shows exactly as typed — same reasoning as productCategoryLabel.
 */
export function serviceItemTypeLabel(name: string): string {
  const key = BUILTIN_SERVICE_ITEM_TYPE_I18N_KEYS[name]
  return key ? translate(`serviceItemTypes.${key}`) : name
}

/** Built-in (app-named, translated) vs. an item type the shop added — see isBuiltinProductCategory. */
export function isBuiltinServiceItemType(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(BUILTIN_SERVICE_ITEM_TYPE_I18N_KEYS, name)
}

const BUILTIN_SERVICE_I18N_KEYS: Record<string, string> = {
  'Ganti Oli Mesin': 'serviceGantiOliMesin',
  'Ganti Filter Oli': 'serviceGantiFilterOli',
  'Ganti Oli Transmisi': 'serviceGantiOliTransmisi',
  'Ganti Oli Gardan': 'serviceGantiOliGardan',
  'Ganti Filter Solar': 'serviceGantiFilterSolar',
  'Ganti Minyak Rem': 'serviceGantiMinyakRem',
  'Ganti Minyak Power Steering': 'serviceGantiMinyakPowerSteering',
}

/**
 * Translated label for a service catalog entry's name. The seven seeded/
 * built-in services are translated for DISPLAY only — same
 * productCategoryLabel/serviceItemTypeLabel shape. Never use this for a work
 * order line's description: serviceCatalogLine (src/lib/serviceCatalog.ts)
 * deliberately copies the raw stored name, because serviceUsageCounts and
 * CheckoutServiceCards' "N on ticket" badge both key on service.name by
 * equality — writing a translated string onto a line would silently break
 * both the moment the active language differs from when the line was added.
 */
export function serviceCatalogLabel(name: string): string {
  const key = BUILTIN_SERVICE_I18N_KEYS[name]
  return key ? translate(`inventory.${key}`) : name
}

/** Built-in (app-named, translated) vs. a service the shop added — see
 *  isBuiltinProductCategory. Used to lock the name field in
 *  ServiceFormDialog.tsx the same way TaxonomyList locks a built-in
 *  category/item-type's name. */
export function isBuiltinServiceCatalogItem(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(BUILTIN_SERVICE_I18N_KEYS, name)
}

// Expenses' categories are a fixed list (expenseStore.ts's EXPENSE_CATEGORIES),
// not a shop-editable taxonomy like product categories/service item types
// above — so there's no isBuiltinExpenseCategory counterpart, only the label.
const EXPENSE_CATEGORY_I18N_KEYS: Record<string, string> = {
  'Inventory Purchase': 'categoryInventoryPurchase',
  Rent: 'categoryRent',
  Utilities: 'categoryUtilities',
  Equipment: 'categoryEquipment',
  Payroll: 'categoryPayroll',
  Insurance: 'categoryInsurance',
  Marketing: 'categoryMarketing',
  Supplies: 'categorySupplies',
  'Repairs & Maintenance': 'categoryRepairsMaintenance',
  Other: 'categoryOther',
}

/** Same shape as productCategoryLabel/serviceItemTypeLabel — an unrecognized
 *  category (shouldn't happen; the category Select only offers this fixed
 *  list) falls back to categoryOther rather than showing raw English. */
export function expenseCategoryLabel(category: string): string {
  const key = EXPENSE_CATEGORY_I18N_KEYS[category] ?? 'categoryOther'
  return translate(`expenses.${key}`)
}

/**
 * A by-id → translated-label lookup for service item types — the same
 * `itemTypes.find(it => it.id === id) → serviceItemTypeLabel(...) ?? "unknown"`
 * shape that used to be copied verbatim into six call sites (Vehicles.tsx,
 * ServiceHistory.tsx, Reminders.tsx, ScheduleRulesEditor.tsx,
 * VehicleServiceHistoryDialog.tsx, receiptDueLines.ts). Returns a function
 * rather than doing the lookup directly so a caller building it once outside
 * a loop/render doesn't re-scan `itemTypes` per row.
 */
export function itemTypeNameLookup<T extends { id: string; name: string }>(itemTypes: T[]): (id: string) => string {
  return (id) => {
    const found = itemTypes.find((it) => it.id === id)
    return found ? serviceItemTypeLabel(found.name) : translate('common.unknown')
  }
}

/** The seeded name of the engine-oil item type — see serviceItemTypeStore's DEFAULT_SERVICE_ITEM_TYPES. */
export const ENGINE_OIL_ITEM_TYPE_NAME = 'Oli Mesin'

/**
 * The engine-oil item type, or undefined if this shop renamed or removed it.
 * Matched by name because ids are generated on the device's first run — there
 * is no stable id to hardcode. Undefined has to stay a real answer the caller
 * handles: a customer's "tiap 3.000 km" means engine oil specifically, and
 * falling back to whatever item type happens to be first would quietly put that
 * interval on their gardan oil.
 */
export function findEngineOilItemType<T extends { name: string }>(itemTypes: T[]): T | undefined {
  return itemTypes.find((it) => it.name === ENGINE_OIL_ITEM_TYPE_NAME)
}

/** A product's stock unit — fixed set, unlike categories/item types shops can't extend this list. */
export const PRODUCT_UNITS = ['each', 'liter', 'galon', 'case', 'box'] as const

const UNIT_I18N_KEYS: Record<string, string> = {
  each: 'unitEach', liter: 'unitLiter', galon: 'unitGalon', case: 'unitCase', box: 'unitBox',
}

/** Translated label for a product's stock unit. */
export function unitLabel(unit: string): string {
  return translate(`inventory.${UNIT_I18N_KEYS[unit] ?? 'unitEach'}`)
}

const ORDER_STATUS_I18N_KEYS: Record<string, string> = {
  open: 'statusOpen',
  completed: 'statusCompleted',
  cancelled: 'statusCancelled',
  pending: 'statusPending',
}

/** Translated label for a work order's (possibly display-only, see
 *  receivables.ts's orderDisplayStatus) status. */
export function orderStatusLabel(status: string): string {
  const key = ORDER_STATUS_I18N_KEYS[status] ?? 'statusOpen'
  return translate(`workOrders.${key}`)
}

/**
 * "Every 5,000 km or 4 months" / "Every 20,000 km" / "Every 4 months" — a
 * service catalog entry's default reminder interval, whichever threshold
 * comes first. null when neither is set, so callers can fall back to "-".
 */
export function serviceIntervalLabel(intervalKm?: number | null, intervalMonths?: number | null): string | null {
  if (intervalKm && intervalMonths) {
    return translate('inventory.intervalKmAndMonths', { km: formatNumber(intervalKm), months: intervalMonths })
  }
  if (intervalKm) return translate('inventory.intervalKmOnly', { km: formatNumber(intervalKm) })
  if (intervalMonths) return translate('inventory.intervalMonthsOnly', { months: intervalMonths })
  return null
}

/**
 * Which axis a km/months interval pair represents — the same "track by
 * distance, time, both, or neither" question the Add/Edit Service dialog and
 * the per-vehicle Schedule setup form both ask, so the picker in each never
 * disagrees with what serviceIntervalLabel would print for the same pair.
 * Truthiness-based like serviceIntervalLabel itself: 0 counts as unset, same
 * as the parse-or-null rule ServiceCatalogTable.handleSave already follows.
 */
export type IntervalAxis = 'none' | 'km' | 'months' | 'both'

export function intervalAxisOf(intervalKm?: number | null, intervalMonths?: number | null): IntervalAxis {
  if (intervalKm && intervalMonths) return 'both'
  if (intervalKm) return 'km'
  if (intervalMonths) return 'months'
  return 'none'
}

/**
 * "Detected: Honda (Japan) · ~1991" — the offline VIN decode result
 * (lib/vinDecode.ts) as a single display line. null when decode found
 * nothing at all, so callers can skip rendering rather than show an empty hint.
 */
export function vinDecodeSummary(result: { manufacturer: string | null; country: string | null; modelYear: number | null }): string | null {
  const parts: string[] = []
  if (result.manufacturer) parts.push(result.country ? `${result.manufacturer} (${result.country})` : result.manufacturer)
  else if (result.country) parts.push(result.country)
  if (result.modelYear) parts.push(`~${result.modelYear}`)
  if (parts.length === 0) return null
  return translate('vehicles.vinDecodedPrefix', { detail: parts.join(' · ') })
}
