// Shared conventions for entity stores: every entity gets a newId() uuid and an
// ISO createdAt stamp, and list mutations are immutable by-id operations. Store
// files keep their own named interfaces (addCustomer, updateProduct, …) but
// implement them with these so the conventions live in one place.

import { newId } from '../lib/id'

export interface BaseEntity {
  id: string
  createdAt: string
}

/** Stamp a new entity with id + createdAt. */
export function newEntity<T>(data: T): T & BaseEntity {
  return { ...data, id: newId(), createdAt: new Date().toISOString() }
}

export function updateById<T extends { id: string }>(list: T[], id: string, data: Partial<T>): T[] {
  return list.map((item) => (item.id === id ? { ...item, ...data } : item))
}

export function removeById<T extends { id: string }>(list: T[], id: string): T[] {
  return list.filter((item) => item.id !== id)
}

/** Same as updateById, but also stamps `updatedAt` — for the handful of stores
 *  (appointments, bays) whose entity tracks a last-modified time alongside
 *  createdAt. */
export function touchById<T extends { id: string; updatedAt: string }>(
  list: T[],
  id: string,
  data: Partial<T>
): T[] {
  return list.map((item) => (item.id === id ? { ...item, ...data, updatedAt: new Date().toISOString() } : item))
}

/** The single definition of "by id" for reads, same spirit as updateById/removeById
 *  for writes. */
export function findById<T extends { id: string }>(list: T[], id: string): T | undefined {
  return list.find((item) => item.id === id)
}

/**
 * Marks exactly one item in `items` as the flag-holder within its group,
 * clearing the flag on every other member of that same group. Used where an
 * entity has an "is the default one for X" flag that only makes sense to hold
 * once per group (e.g. a vehicle's owner) — vehicleStore.setDefaultVehicle
 * had it hand-written before this was extracted. Items outside the target's
 * group are left untouched;
 * a target with no group (groupKeyOf returns null) is treated as its own group
 * of one, so its flag is still set but nothing else is touched.
 */
export function withExclusiveFlag<T extends { id: string }>(
  items: T[],
  targetId: string,
  groupKeyOf: (item: T) => string | null,
  flagKey: keyof T
): T[] {
  const target = items.find((item) => item.id === targetId)
  if (!target) return items
  const groupKey = groupKeyOf(target)
  return items.map((item) =>
    groupKeyOf(item) === groupKey ? { ...item, [flagKey]: item.id === targetId } : item
  )
}
