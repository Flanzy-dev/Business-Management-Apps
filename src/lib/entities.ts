// Shared entity-display helpers. Pure functions (no hooks) that take the store
// arrays explicitly, so the label/owner-resolution logic lives in one place
// instead of being re-implemented in every page. Callers keep thin one-line
// closures that bind their own store data to these.
import type { Vehicle } from '../store/vehicleStore'
import type { Customer } from '../store/customerStore'
import type { Company } from '../store/companyStore'
import type { Worker } from '../store/workerStore'
import { translate } from './i18n'

/** "2021 Toyota Avanza" — vehicle year/make/model, no plate. */
export function vehicleLabel(v?: Vehicle | null): string {
  if (!v) return 'Unknown vehicle'
  return `${v.year || ''} ${v.make} ${v.model}`.trim()
}

/** "2021 Toyota Avanza - B 1234 XYZ" — vehicle label with plate appended. */
export function vehicleLabelWithPlate(v?: Vehicle | null): string {
  if (!v) return 'Unknown vehicle'
  return `${v.year || ''} ${v.make} ${v.model} - ${v.licensePlate}`.trim()
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
  Oil: 'categoryOil', Filter: 'categoryFilter', Fluid: 'categoryFluid',
  Parts: 'categoryParts', Supplies: 'categorySupplies', Other: 'categoryOther',
}

/**
 * Translated label for a product category name. The six seeded/built-in
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

/** A product's stock unit — fixed set, unlike categories/item types shops can't extend this list. */
export const PRODUCT_UNITS = ['each', 'liter', 'case', 'box'] as const

const UNIT_I18N_KEYS: Record<string, string> = {
  each: 'unitEach', liter: 'unitLiter', case: 'unitCase', box: 'unitBox',
}

/** Translated label for a product's stock unit. */
export function unitLabel(unit: string): string {
  return translate(`inventory.${UNIT_I18N_KEYS[unit] ?? 'unitEach'}`)
}

/**
 * "Every 5,000 km or 4 months" / "Every 20,000 km" / "Every 4 months" — a
 * service catalog entry's default reminder interval, whichever threshold
 * comes first. null when neither is set, so callers can fall back to "-".
 */
export function serviceIntervalLabel(intervalKm?: number | null, intervalMonths?: number | null): string | null {
  if (intervalKm && intervalMonths) {
    return translate('inventory.intervalKmAndMonths', { km: intervalKm.toLocaleString(), months: intervalMonths })
  }
  if (intervalKm) return translate('inventory.intervalKmOnly', { km: intervalKm.toLocaleString() })
  if (intervalMonths) return translate('inventory.intervalMonthsOnly', { months: intervalMonths })
  return null
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
