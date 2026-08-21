// Matching + per-result enrichment behind the Ctrl+K palette
// (src/components/GlobalSearch.tsx). No store access — the component reads
// stores and passes arrays in, same pattern as finance.ts/reminders.ts.
//
// "Next due" and "mileage at last visit" used to be computed here with a
// hand-rolled +3-months guess and an `as any` read of a field the work-order
// store's v1->v2 migration deleted (mileageIn -> odometerAtArrival/
// odometerAtService). Both now delegate to the real engines every other
// screen uses — vehicleDueSummary.ts's getVehicleDueStatus (same as
// Vehicles.tsx and reminders.ts) and the order's own odometer fields — so
// the palette can't show a vehicle a due date that disagrees with the
// Reminders page for the same vehicle.
import type { Vehicle } from '../store/vehicleStore'
import type { Customer } from '../store/customerStore'
import type { Company } from '../store/companyStore'
import type { WorkOrder } from '../store/workOrderStore'
import type { ScheduleRule } from '../store/scheduleRuleStore'
import { getVehicleDueStatus, VehicleDueStatus } from './vehicleDueSummary'

export interface VehicleSearchResult {
  type: 'vehicle'
  id: string
  route: string
  vehicle: Vehicle
  ownerName: string | null
  dueStatus: VehicleDueStatus
  /** ISO timestamp of the last completed order, or null with no service history. */
  lastServiceAt: string | null
  /** Odometer at that order (service reading preferred over arrival), or null
   *  if neither was recorded — never the vehicle's *current* mileage, which
   *  is a different fact (see the header comment). */
  odometerAtLastService: number | null
  /** id of a ServiceItemType tagged on the last order's first tagged line —
   *  the component resolves this to a name/label; matching by structured tag
   *  rather than sniffing the line's free-text description for "oil". */
  serviceItemTypeId: string | null
}

export interface CustomerSearchResult {
  type: 'customer'
  id: string
  route: string
  name: string
  phone: string | null
}

export interface WorkOrderSearchResult {
  type: 'workorder'
  id: string
  route: string
  orderNumber: number
  vehicle: Vehicle | null
}

export type SearchResult = VehicleSearchResult | CustomerSearchResult | WorkOrderSearchResult

export interface SearchData {
  vehicles: Vehicle[]
  customers: Customer[]
  companies: Company[]
  workOrders: WorkOrder[]
  scheduleRules: ScheduleRule[]
}

const MIN_QUERY_LENGTH = 2

/**
 * The vehicle's owning customer/company name, or undefined with no owner or
 * an owner that can't be resolved. Matching-only — deliberately distinct
 * from entities.ts's ownerName(), whose fallback strings ("Unknown", "No
 * owner") must never be treated as a real name to match a query against.
 */
function rawOwnerName(v: Vehicle, customers: Customer[], companies: Company[]): string | undefined {
  if (v.customerId) return customers.find((c) => c.id === v.customerId)?.name
  if (v.companyId) return companies.find((c) => c.id === v.companyId)?.companyName
  return undefined
}

/**
 * Vehicles (by plate/VIN/owner name) then customers (by name/phone) then work
 * orders (by order number/owner name) matching `query`. Below
 * MIN_QUERY_LENGTH, returns nothing — the palette's "type at least 2
 * characters" state. Route-based access filtering (canAccessRoute) stays in
 * the component: it's a display-layer concern about what Worker mode may be
 * offered, not a matching rule.
 */
export function buildSearchResults(query: string, data: SearchData, now: Date = new Date()): SearchResult[] {
  if (query.length < MIN_QUERY_LENGTH) return []
  const q = query.toLowerCase()
  const results: SearchResult[] = []

  for (const v of data.vehicles) {
    const plateMatch = v.licensePlate?.toLowerCase().includes(q)
    const vinMatch = v.vin?.toLowerCase().includes(q)
    const ownerMatch = rawOwnerName(v, data.customers, data.companies)?.toLowerCase().includes(q)
    if (!plateMatch && !vinMatch && !ownerMatch) continue
    results.push(buildVehicleResult(v, data, now))
  }

  for (const c of data.customers) {
    const nameMatch = c.name.toLowerCase().includes(q)
    const phoneMatch = c.phone?.toLowerCase().includes(q)
    if (!nameMatch && !phoneMatch) continue
    results.push({ type: 'customer', id: c.id, route: '/customers', name: c.name, phone: c.phone || null })
  }

  for (const wo of data.workOrders) {
    const numberMatch = wo.orderNumber?.toString().includes(q)
    const vehicle = data.vehicles.find((v) => v.id === wo.vehicleId)
    const ownerMatch = vehicle && rawOwnerName(vehicle, data.customers, data.companies)?.toLowerCase().includes(q)
    if (!numberMatch && !ownerMatch) continue
    results.push({
      type: 'workorder',
      id: wo.id,
      route: '/work-orders',
      orderNumber: wo.orderNumber,
      vehicle: vehicle ?? null,
    })
  }

  return results
}

function buildVehicleResult(v: Vehicle, data: SearchData, now: Date): VehicleSearchResult {
  const vehicleOrders = data.workOrders
    .filter((wo) => wo.vehicleId === v.id && wo.status === 'completed')
    .sort((a, b) => new Date(b.completedAt || b.createdAt).getTime() - new Date(a.completedAt || a.createdAt).getTime())
  const lastOrder = vehicleOrders[0] as WorkOrder | undefined

  const liveRules = data.scheduleRules.filter((r) => r.vehicleId === v.id && r.supersededAt === null)
  const dueStatus = getVehicleDueStatus(liveRules, v.currentMileage ?? 0, now)

  const taggedLine = lastOrder?.items.find((item) => item.serviceItemTypeId != null)

  return {
    type: 'vehicle',
    id: v.id,
    route: '/vehicles',
    vehicle: v,
    // rawOwnerName, not entities.ts's ownerName() — that helper's "No owner"/
    // "Unknown" fallback text is hardcoded English, and would bypass the
    // component's own t('globalSearch.noOwner') (GlobalSearch.tsx's
    // resultSubtitle) for Indonesian-locale users. Resolves a company/fleet
    // vehicle too, not just a customerId one — this used to hand-roll a
    // customerId-only lookup, which meant every fleet vehicle silently
    // displayed "No owner" here regardless of locale.
    ownerName: rawOwnerName(v, data.customers, data.companies) ?? null,
    dueStatus,
    lastServiceAt: lastOrder ? lastOrder.completedAt ?? lastOrder.createdAt : null,
    odometerAtLastService: lastOrder ? lastOrder.odometerAtService ?? lastOrder.odometerAtArrival : null,
    serviceItemTypeId: taggedLine?.serviceItemTypeId ?? null,
  }
}
