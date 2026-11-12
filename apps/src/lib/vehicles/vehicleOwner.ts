// Who owns a vehicle (or an appointment): a Customer or a Company, never both.
//
// Stored as two nullable ids — `customerId` / `companyId` — and before this
// file about twenty places re-derived the owner from them by hand:
// `v.companyId ? 'company' : 'customer'`, `c:${id}` vs `customer:${id}` keys,
// four separate "look up the name" branches with three different fallbacks.
// They agreed only because the "either, not both" invariant happens to hold.
// This is the one place that reads the pair; everything else asks it.
//
// The rule, when a row somehow carries both: customerId wins (what
// vehicleStore's setDefaultVehicle and entities.ts's ownerName always did).
// Pure, no store access — callers pass their lists in.

export type OwnerType = 'customer' | 'company'

export interface OwnerRef {
  type: OwnerType
  id: string
}

/** Anything carrying the owner pair: a Vehicle, an Appointment, a draft. */
export interface OwnedRow {
  customerId?: string | null
  companyId?: string | null
}

/** The row's owner, or null when it has none. */
export function ownerOf(row: OwnedRow | null | undefined): OwnerRef | null {
  if (row?.customerId) return { type: 'customer', id: row.customerId }
  if (row?.companyId) return { type: 'company', id: row.companyId }
  return null
}

/** A key no customer id can collide with a company id under. */
export function ownerRefKey(ref: OwnerRef): string {
  return `${ref.type}:${ref.id}`
}

/** The two stored ids for an owner — what a row being written should carry. */
export function ownerFields(ref: OwnerRef | null): { customerId: string | null; companyId: string | null } {
  if (!ref?.id) return { customerId: null, companyId: null }
  return ref.type === 'customer' ? { customerId: ref.id, companyId: null } : { customerId: null, companyId: ref.id }
}

export function isOwnedBy(row: OwnedRow, ref: OwnerRef): boolean {
  const owner = ownerOf(row)
  return owner !== null && owner.type === ref.type && owner.id === ref.id
}

export function vehiclesOf<T extends OwnedRow>(vehicles: T[], ref: OwnerRef): T[] {
  return ref.id ? vehicles.filter((v) => isOwnedBy(v, ref)) : []
}

/** The owner's default vehicle (vehicleStore's isDefault), if they have one marked. */
export function defaultVehicleOf<T extends OwnedRow & { isDefault?: boolean }>(vehicles: T[], ref: OwnerRef): T | undefined {
  return vehiclesOf(vehicles, ref).find((v) => v.isDefault)
}

export interface OwnerDirectory {
  customers: { id: string; name: string; phone?: string; email?: string }[]
  companies: { id: string; companyName: string; phone?: string; email?: string }[]
}

export interface OwnerRecord extends OwnerRef {
  name: string
  phone: string
  email: string
}

/**
 * The owner's record, flattened to the fields both kinds share. Undefined when
 * there's no owner or the id no longer resolves (deleted, or not synced yet) —
 * each caller picks its own fallback text, because a label shown to a person
 * and a name matched against a search query need different ones.
 */
export function findOwner(ref: OwnerRef | null, dir: OwnerDirectory): OwnerRecord | undefined {
  if (!ref) return undefined
  if (ref.type === 'customer') {
    const c = dir.customers.find((x) => x.id === ref.id)
    return c ? { ...ref, name: c.name, phone: c.phone ?? '', email: c.email ?? '' } : undefined
  }
  const c = dir.companies.find((x) => x.id === ref.id)
  return c ? { ...ref, name: c.companyName, phone: c.phone ?? '', email: c.email ?? '' } : undefined
}
