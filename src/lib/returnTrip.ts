// The URL-param contract for "arrive here via ?new=1 with the Add form
// already open, then hop back to wherever asked once saved" — used whenever
// a related record (a vehicle, a driver, a supplier) needs a not-yet-existing
// customer/company/vehicle/supplier created first, mid-flow, from another
// page's own form. Six near-identical `useEffect`s used to read this by hand
// (Customers, Companies' company and driver flows, Vehicles, Suppliers,
// Expenses), three carrying their own hand-written `exhaustive-deps` disable
// with the same justification comment repeated each time.

export interface NewEntityRequest {
  /** True when `?<param>=1` is present at all — the Add form should open. */
  open: boolean
  /** True when the accompanying "come back to where I started" flag is also
   *  set. Callers with nowhere to return to (Expenses.tsx, always the final
   *  leg of its own round trip) simply don't read this field. */
  shouldReturn: boolean
}

/**
 * Reads `?<param>=1` (default `'new'`) plus `?<returnFlag>=1` (default
 * `'fromOrder'`; Suppliers' round trip back to Expenses uses `'fromExpense'`,
 * Companies' driver sub-flow reads the same `'new'`-shaped param under
 * `'newDriver'`). Does not clear the params — the caller still owns calling
 * `setSearchParams({}, { replace: true })` once it's done acting on the
 * request, same as before.
 */
export function parseNewEntityRequest(
  searchParams: URLSearchParams,
  opts: { param?: string; returnFlag?: string } = {}
): NewEntityRequest {
  const { param = 'new', returnFlag = 'fromOrder' } = opts
  return {
    open: searchParams.get(param) === '1',
    shouldReturn: searchParams.get(returnFlag) === '1',
  }
}

/**
 * The `/work-orders?new=1&ownerType=...&ownerId=...` round-trip target once a
 * new owner — or a new vehicle/driver under one — has been created mid-flow.
 * `extra` covers the one-off params each caller adds on top (Vehicles'
 * `vehicleId`, Companies' driver flow's `driverId`).
 */
export function workOrderReturnPath(
  ownerType: 'customer' | 'company',
  ownerId: string,
  extra?: Record<string, string>
): string {
  const params = new URLSearchParams({ new: '1', ownerType, ownerId, ...extra })
  return `/work-orders?${params.toString()}`
}

/** The other end of workOrderReturnPath — what NewWorkOrderDialog reads back
 *  out of those same params. `open` uses a truthy check on `new`, not a
 *  strict `'1'` compare like parseNewEntityRequest's `open` above: every
 *  caller of workOrderReturnPath sets literal `'1'`, but this keeps the
 *  dialog's original looser check rather than tightening it as a side effect
 *  of this extraction. */
export interface NewOrderParams {
  open: boolean
  ownerType?: 'customer' | 'company'
  ownerId?: string
  vehicleId?: string
  driverId?: string
  /** Set only by Reminders.tsx's "Start Work Order" on an Overdue row — tells
   *  NewWorkOrderDialog to auto-add a line for whatever's overdue once the
   *  order is created (see serviceSuggestions.ts's overdueServiceSuggestions). */
  autoAddOverdue?: boolean
}

export function parseNewOrderParams(searchParams: URLSearchParams): NewOrderParams {
  if (!searchParams.get('new')) return { open: false }
  const ownerTypeParam = searchParams.get('ownerType')
  return {
    open: true,
    ownerType: ownerTypeParam === 'customer' || ownerTypeParam === 'company' ? ownerTypeParam : undefined,
    ownerId: searchParams.get('ownerId') ?? undefined,
    vehicleId: searchParams.get('vehicleId') ?? undefined,
    driverId: searchParams.get('driverId') ?? undefined,
    autoAddOverdue: searchParams.get('autoAddOverdue') === '1',
  }
}
