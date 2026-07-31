// Shared conventions for entity stores: every entity gets a crypto.randomUUID()
// id and an ISO createdAt stamp, and list mutations are immutable by-id
// operations. Store files keep their own named interfaces (addCustomer,
// updateProduct, …) but implement them with these so the conventions live in
// one place.

export interface BaseEntity {
  id: string
  createdAt: string
}

/** Stamp a new entity with id + createdAt. */
export function newEntity<T>(data: T): T & BaseEntity {
  return { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() }
}

export function updateById<T extends { id: string }>(list: T[], id: string, data: Partial<T>): T[] {
  return list.map((item) => (item.id === id ? { ...item, ...data } : item))
}

export function removeById<T extends { id: string }>(list: T[], id: string): T[] {
  return list.filter((item) => item.id !== id)
}
