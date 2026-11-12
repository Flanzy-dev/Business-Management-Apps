// The search boxes of the Customers/Companies/Vehicles/Suppliers/Technicians
// lists and the Ctrl+K palette's vehicle matching — one rule for all of them
// (searchText.ts): words in any order, case ignored, phone numbers with or
// without their dashes, and a near-miss spelling as a fallback. They had
// drifted apart before (phone was once matched case-sensitively in four of
// five pages), which is why the rule lives here and not in each page.
import type { Vehicle } from '../../store/vehicleStore'
import { plateKey, plateMatches } from '../vehicles/vehicleIdentity'
import { filterMatches, searchMatch, searchTokens, type MatchKind } from './searchText'

/**
 * Items whose `fields`, taken together, contain every word of `query`.
 * Blank/whitespace-only query matches everything (so callers don't need their
 * own "no filter" branch). Near-miss spellings ("santosa" for "Santoso") only
 * show when nothing matched exactly, so a search that works isn't cluttered.
 */
export function filterBySearch<T>(items: T[], query: string, fields: (item: T) => (string | null | undefined)[]): T[] {
  const q = query.trim().toLowerCase()
  if (!q) return items
  const tokens = searchTokens(q)
  return filterMatches(items, (item) => searchMatch(fields(item).map((f) => f ?? '').join(' '), tokens), 'onlyWhenNoExact')
}

type VehicleFields = Pick<Vehicle, 'make' | 'model' | 'vin' | 'licensePlate'>

/**
 * How a vehicle matches `query` — by plate the way every plate lookup works
 * (plateMatches: "h4321ab", "H4321" and "h 4321" all find "H 4321 AB"), and
 * otherwise by words in any order across plate, make, model, VIN and
 * `ownerText` (the owner's name and phone), so "budi 1234" finds Budi's car.
 */
export function vehicleMatch(v: VehicleFields, query: string, ownerText = ''): MatchKind | null {
  const q = query.trim().toLowerCase()
  if (!q) return 'exact'
  if (plateMatches(v.licensePlate, q)) return 'exact'
  const plate = plateKey(v.licensePlate)
  return searchMatch(`${v.licensePlate} ${v.make} ${v.model} ${v.vin} ${ownerText}`, searchTokens(q), (token) => {
    const typed = plateKey(token)
    return typed !== '' && plate.includes(typed)
  })
}

/** The Vehicles page's list: vehicleMatch, exact hits first, near-misses after. */
export function filterVehiclesBySearch<T extends VehicleFields>(items: T[], query: string, ownerText?: (vehicle: T) => string): T[] {
  if (!query.trim()) return items
  return filterMatches(items, (v) => vehicleMatch(v, query, ownerText?.(v)))
}
