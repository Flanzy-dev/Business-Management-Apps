// What makes two vehicle rows "the same vehicle" — the vehicle counterpart of
// productIdentity.ts. Pure: callers pass their own vehicle list in.
//
// A licence plate is the one identifier every vehicle in this shop has and
// every customer knows by heart, so it's the identity. Two rows sharing a
// plate split one car's history in half: half its orders under each, two
// schedules reminding about it, two owners claiming it. That happened at scale
// once already — the pre-app Excel logs recorded the same plate under two
// customer files (src/lib/customers/customerHistoryImport.ts) — and the Add Vehicle form
// would let anyone do it by hand. Every place that asks "is this plate already
// here?" (the form, the importer, search, the merge tool) asks it through this
// file, so they can never disagree.
import type { Vehicle } from '../../store/vehicleStore'

/**
 * The form two plates are compared by: uppercase, letters and digits only.
 * "H 4321 AB", "h4321ab" and "H-4321-AB" are one key. An empty plate gives
 * '' — and '' is never a duplicate of anything (see findVehicleByPlate), since
 * "no plate recorded" says nothing about which car it is.
 */
export function plateKey(plate: string | null | undefined): string {
  return (plate ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

/**
 * The *stored* form: uppercase, single spaces, trimmed — "h  4321 ab" is saved
 * as "H 4321 AB". Normalizing on save (the same call
 * productIdentity.ts's normalizeSupplierCode makes) means the table, the
 * receipt, search and an export all show one string.
 */
export function formatPlate(plate: string | null | undefined): string {
  return (plate ?? '').toUpperCase().replace(/\s+/g, ' ').trim()
}

/**
 * Does a plate search query match this plate? Compared by key, so "h4321"
 * finds "H 4321 AB" — a plain substring check on the stored form wouldn't,
 * because of the spaces.
 */
export function plateMatches(plate: string | null | undefined, query: string): boolean {
  const q = plateKey(query)
  return q !== '' && plateKey(plate).includes(q)
}

/**
 * The vehicle already carrying this plate, ignoring `excludeId` (the vehicle
 * being edited, which may of course keep its own plate). Undefined for an
 * empty plate.
 */
export function findVehicleByPlate<T extends Pick<Vehicle, 'id' | 'licensePlate'>>(
  vehicles: T[],
  plate: string,
  excludeId?: string
): T | undefined {
  const key = plateKey(plate)
  if (!key) return undefined
  return vehicles.find((v) => v.id !== excludeId && plateKey(v.licensePlate) === key)
}

/**
 * Every set of two or more vehicles sharing a plate — what the merge tool
 * offers to fix. Ordered by plate; vehicles keep their list order within a
 * group.
 */
export function duplicatePlateGroups<T extends Pick<Vehicle, 'id' | 'licensePlate'>>(vehicles: T[]): T[][] {
  const byKey = new Map<string, T[]>()
  for (const v of vehicles) {
    const key = plateKey(v.licensePlate)
    if (!key) continue
    const group = byKey.get(key)
    if (group) group.push(v)
    else byKey.set(key, [v])
  }
  return [...byKey.entries()]
    .filter(([, group]) => group.length > 1)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, group]) => group)
}
