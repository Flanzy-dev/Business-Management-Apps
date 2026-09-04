// The single source of truth for what Worker mode can reach — Layout's nav
// filter, the RequireAdmin route guard, useKeyboardShortcuts, and
// GlobalSearch all call these same functions rather than each keeping their
// own list, so the four can't quietly drift apart. Pure and store-free on
// purpose: Vitest here runs with environment:'node' and no jsdom or React
// Testing Library, so this is the only layer a test can exercise directly.
//
// The actual route table (which paths exist, worker-accessible or not) lives
// in src/lib/routes.ts — this module derives WORKER_ROUTES from it rather
// than restating the list, so a route added there can't silently diverge
// from what the guard below allows.
import { ROUTES, ROUTE_ALIASES } from '../routes'

export type Mode = 'admin' | 'worker'

/** An allow-list, not a deny-list: a route added to routes.ts is admin-only
 *  until someone deliberately marks it workerAccessible there. */
export const WORKER_ROUTES: readonly string[] = ROUTES.filter((r) => r.workerAccessible).map((r) => r.path)

function normalizeRoute(path: string): string {
  const withoutQueryOrHash = path.split('?')[0].split('#')[0]
  const withLeadingSlash = withoutQueryOrHash.startsWith('/') ? withoutQueryOrHash : `/${withoutQueryOrHash}`
  const collapsed = withLeadingSlash.length > 1 ? withLeadingSlash.replace(/\/+$/, '') : withLeadingSlash
  return ROUTE_ALIASES[collapsed] ?? collapsed
}

export function canAccessRoute(mode: Mode, path: string): boolean {
  if (mode === 'admin') return true
  return WORKER_ROUTES.includes(normalizeRoute(path))
}

/** Cost price, margin/profit, and revenue aggregates — hidden from Worker
 *  mode. Selling prices and order totals are NOT gated by this; a worker
 *  handing a customer a bill needs to see and print the total. */
export function canSeeCostAndProfit(mode: Mode): boolean {
  return mode === 'admin'
}

/** Add/edit/delete/adjust-stock actions in Inventory — Worker mode is
 *  read-only there (stock levels visible, nothing else). */
export function canMutateInventory(mode: Mode): boolean {
  return mode === 'admin'
}

/** Recording stock that has physically arrived. Deliberately looser than
 *  canMutateInventory: the shop floor is where an arrival is actually seen,
 *  so Worker mode may record the QUANTITY — quantity only. Capturing its
 *  cost (and a linked expense) still needs canSeeCostAndProfit, so an
 *  arrival a Worker records opens a lot at the product's existing cost
 *  price and books no expense. */
export function canReceiveStock(_mode: Mode): boolean {
  return true
}

/** Supplier code — a vendor-relationship detail, not a price fact. Hidden
 *  from Worker mode; the supplier NAME column is unaffected. */
export function canSeeSupplierCode(mode: Mode): boolean {
  return mode === 'admin'
}

/** Voiding a completed (booked) sale is a financial reversal — Admin only.
 *  Deleting an open order that never took payment is not gated by this. */
export function canVoidOrder(mode: Mode): boolean {
  return mode === 'admin'
}
