// Matching + per-result enrichment behind the Ctrl+K palette
// (src/components/search/GlobalSearch.tsx). No store access — the component reads
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
import type { Vehicle } from '../../store/vehicleStore'
import type { Customer } from '../../store/customerStore'
import type { Company } from '../../store/companyStore'
import type { WorkOrder } from '../../store/workOrderStore'
import type { ScheduleRule } from '../../store/scheduleRuleStore'
import { getVehicleDueStatus, VehicleDueStatus } from '../vehicles/vehicleDueSummary'
import { ownerOf } from '../vehicles/vehicleOwner'
import { visitOdometer } from '../vehicles/visitOdometer'
import { vehicleMatch } from '../format/entitySearch'
import { filterMatches, searchMatch, searchTokens } from '../format/searchText'

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
  orderNumberSuffix?: string
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

interface OwnerInfo {
  name: string
  phone: string
}

/**
 * Every vehicle owner's name and phone, by `type:id` — built once per search.
 * Looking the owner up per vehicle and per order (a linear `customers.find`
 * each time) made every keystroke orders × customers comparisons once the
 * shop's history was imported. Real names only: entities.ts's ownerName()
 * fallbacks ("Unknown", "No owner") must never be matched against a query.
 */
function ownerIndex(data: SearchData): Map<string, OwnerInfo> {
  const index = new Map<string, OwnerInfo>()
  for (const c of data.customers) index.set(`customer:${c.id}`, { name: c.name, phone: c.phone ?? '' })
  for (const c of data.companies) index.set(`company:${c.id}`, { name: c.companyName, phone: c.phone ?? '' })
  return index
}

function ownerFor(v: Vehicle, owners: Map<string, OwnerInfo>): OwnerInfo | undefined {
  const ref = ownerOf(v)
  return ref ? owners.get(`${ref.type}:${ref.id}`) : undefined
}

/** Each vehicle's latest completed order — one pass over the orders, instead
 *  of a filter + sort of every order for every vehicle in the results. */
function lastCompletedOrderByVehicle(orders: WorkOrder[]): Map<string, WorkOrder> {
  const at = (wo: WorkOrder) => new Date(wo.completedAt || wo.createdAt).getTime()
  const latest = new Map<string, WorkOrder>()
  for (const wo of orders) {
    if (wo.status !== 'completed') continue
    const prev = latest.get(wo.vehicleId)
    if (!prev || at(wo) > at(prev)) latest.set(wo.vehicleId, wo)
  }
  return latest
}

/**
 * Vehicles (by plate, VIN, make/model, owner name or phone) then customers (by
 * name/phone) then work orders (by order number/owner name) matching `query`
 * — the same rule as Quick Find and the list pages (searchText.ts): words in
 * any order ("budi 1234"), a phone with or without dashes, exact hits before
 * near-miss spellings. Below MIN_QUERY_LENGTH, returns nothing — the palette's
 * "type at least 2 characters" state. Route-based access filtering
 * (canAccessRoute) stays in the component: it's a display-layer concern about
 * what Worker mode may be offered, not a matching rule.
 */
export function buildSearchResults(query: string, data: SearchData, now: Date = new Date()): SearchResult[] {
  if (query.trim().length < MIN_QUERY_LENGTH) return []
  const q = query.trim().toLowerCase()
  const tokens = searchTokens(q)
  const owners = ownerIndex(data)

  const vehicles = filterMatches(data.vehicles, (v) => {
    const owner = ownerFor(v, owners)
    return vehicleMatch(v, q, owner ? `${owner.name} ${owner.phone}` : '')
  })
  const lastOrders = vehicles.length > 0 ? lastCompletedOrderByVehicle(data.workOrders) : new Map<string, WorkOrder>()

  const customers = filterMatches(data.customers, (c) => searchMatch(`${c.name} ${c.phone ?? ''}`, tokens))

  // Was a .find() per order — one map instead of an O(n·m) scan.
  const vehicleById = new Map(data.vehicles.map((v) => [v.id, v]))
  const typedNumber = q.replace(/[^a-z0-9]/g, '')
  const orders = filterMatches(data.workOrders, (wo) => {
    if (typedNumber && `${wo.orderNumber}${wo.orderNumberSuffix ?? ''}`.toLowerCase().includes(typedNumber)) return 'exact'
    const vehicle = vehicleById.get(wo.vehicleId)
    const owner = vehicle && ownerFor(vehicle, owners)
    return owner ? searchMatch(owner.name, tokens) : null
  })

  // Vehicles, then customers, then work orders — the order the palette groups results in.
  return [
    ...vehicles.map((v) => buildVehicleResult(v, data, owners, lastOrders, now)),
    ...customers.map((c): CustomerSearchResult => ({ type: 'customer', id: c.id, route: '/customers', name: c.name, phone: c.phone || null })),
    ...orders.map((wo): WorkOrderSearchResult => ({
      type: 'workorder',
      id: wo.id,
      route: '/work-orders',
      orderNumber: wo.orderNumber,
      orderNumberSuffix: wo.orderNumberSuffix,
      vehicle: vehicleById.get(wo.vehicleId) ?? null,
    })),
  ]
}

function buildVehicleResult(
  v: Vehicle,
  data: SearchData,
  owners: Map<string, OwnerInfo>,
  lastOrders: Map<string, WorkOrder>,
  now: Date
): VehicleSearchResult {
  const lastOrder = lastOrders.get(v.id)

  const liveRules = data.scheduleRules.filter((r) => r.vehicleId === v.id && r.supersededAt === null)
  const dueStatus = getVehicleDueStatus(liveRules, v.currentMileage ?? 0, now)

  const taggedLine = lastOrder?.items.find((item) => item.serviceItemTypeId != null)

  return {
    type: 'vehicle',
    id: v.id,
    route: '/vehicles',
    vehicle: v,
    // The owner index, not entities.ts's ownerName() — that helper's "No owner"/
    // "Unknown" fallback text is hardcoded English, and would bypass the
    // component's own t('globalSearch.noOwner') (GlobalSearch.tsx's
    // resultSubtitle) for Indonesian-locale users. Resolves a company/fleet
    // vehicle too, not just a customerId one — this used to hand-roll a
    // customerId-only lookup, which meant every fleet vehicle silently
    // displayed "No owner" here regardless of locale.
    ownerName: ownerFor(v, owners)?.name ?? null,
    dueStatus,
    lastServiceAt: lastOrder ? lastOrder.completedAt ?? lastOrder.createdAt : null,
    odometerAtLastService: lastOrder ? visitOdometer(lastOrder) : null,
    serviceItemTypeId: taggedLine?.serviceItemTypeId ?? null,
  }
}
