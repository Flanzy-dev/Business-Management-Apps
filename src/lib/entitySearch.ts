// One case-insensitive substring match across a row's searchable fields —
// the same shape Customers/Companies/Vehicles/Suppliers/Technicians each
// hand-wrote inline, and had already drifted apart: phone was matched
// case-*sensitively* in four of the five while every other field was
// lowercased first. Modeled on src/lib/productFilter.ts's matchesQuery,
// generalized to an arbitrary field list instead of one hardcoded triplet.

/**
 * `query` is matched against every string `fields` returns for that item,
 * lowercased on both sides. Blank/whitespace-only query matches everything
 * (so callers don't need their own "no filter" branch).
 */
export function filterBySearch<T>(items: T[], query: string, fields: (item: T) => (string | null | undefined)[]): T[] {
  const q = query.trim().toLowerCase()
  if (!q) return items
  return items.filter((item) => fields(item).some((f) => (f ?? '').toLowerCase().includes(q)))
}
