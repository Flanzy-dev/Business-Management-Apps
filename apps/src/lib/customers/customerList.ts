// The Customers page's rows: each customer with the facts the counter
// actually looks for (their cars, when they were last in), a search that
// finds a customer by plate as well as by name/phone/email, and column sort.
// Plain .ts so the rules are testable.
import type { Customer } from '../../store/customerStore'
import type { Vehicle } from '../../store/vehicleStore'
import type { WorkOrder } from '../../store/workOrderStore'
import { plateKey, plateMatches } from '../vehicles/vehicleIdentity'
import { filterMatches, searchMatch, searchTokens } from '../format/searchText'

export interface CustomerRow {
  customer: Customer
  plates: string[]
  /** ISO date of the latest completed order on any of their vehicles. */
  lastVisit: string | null
}

export function buildCustomerRows(customers: Customer[], vehicles: Vehicle[], workOrders: WorkOrder[]): CustomerRow[] {
  const vehiclesByCustomer = new Map<string, Vehicle[]>()
  // customerId wins over companyId (src/lib/vehicles/vehicleOwner.ts), so a vehicle
  // with a customerId is that customer's whatever else it carries.
  for (const v of vehicles) {
    if (!v.customerId) continue
    const list = vehiclesByCustomer.get(v.customerId)
    if (list) list.push(v)
    else vehiclesByCustomer.set(v.customerId, [v])
  }
  const lastVisitByVehicle = new Map<string, string>()
  for (const wo of workOrders) {
    if (wo.status !== 'completed') continue
    const prev = lastVisitByVehicle.get(wo.vehicleId)
    if (!prev || wo.date > prev) lastVisitByVehicle.set(wo.vehicleId, wo.date)
  }
  return customers.map((customer) => {
    const own = vehiclesByCustomer.get(customer.id) ?? []
    let lastVisit: string | null = null
    for (const v of own) {
      const at = lastVisitByVehicle.get(v.id)
      if (at && (!lastVisit || at > lastVisit)) lastVisit = at
    }
    return { customer, plates: own.map((v) => v.licensePlate).filter(Boolean), lastVisit }
  })
}

/**
 * Name, phone and email by words in any order (searchText.ts) — "santoso budi",
 * a phone typed without its dashes — and plates the way every plate lookup
 * matches (spacing and case ignored). The table is sorted by column, so a
 * near-miss spelling shows only when nothing matched exactly. A blank query
 * keeps every row.
 */
export function filterCustomerRows(rows: CustomerRow[], query: string): CustomerRow[] {
  const q = query.trim().toLowerCase()
  if (!q) return rows
  const tokens = searchTokens(q)
  return filterMatches(
    rows,
    ({ customer, plates }) => {
      if (plates.some((p) => plateMatches(p, q))) return 'exact'
      const plateKeys = plates.map(plateKey)
      return searchMatch(`${customer.name} ${customer.phone} ${customer.email} ${plates.join(' ')}`, tokens, (token) => {
        const typed = plateKey(token)
        return typed !== '' && plateKeys.some((p) => p.includes(typed))
      })
    },
    'onlyWhenNoExact'
  )
}

export type CustomerSortKey = 'name' | 'vehicles' | 'lastVisit'
export interface CustomerSort {
  key: CustomerSortKey
  direction: 'asc' | 'desc'
}

export const DEFAULT_CUSTOMER_SORT: CustomerSort = { key: 'name', direction: 'asc' }

/** Same column behaviour as the inventory table: the active column flips; a
 *  new column starts A–Z for names and biggest/newest first otherwise. */
export function nextCustomerSort(current: CustomerSort, key: CustomerSortKey): CustomerSort {
  if (current.key === key) return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
  return { key, direction: key === 'name' ? 'asc' : 'desc' }
}

function compareName(a: CustomerRow, b: CustomerRow): number {
  return a.customer.name.localeCompare(b.customer.name, 'id', { numeric: true, sensitivity: 'base' })
}

/** Sorted copy. Never-visited customers sort as the oldest; ties break A–Z. */
export function sortCustomerRows(rows: CustomerRow[], sort: CustomerSort): CustomerRow[] {
  const sign = sort.direction === 'asc' ? 1 : -1
  const compare = (a: CustomerRow, b: CustomerRow): number => {
    if (sort.key === 'vehicles') return a.plates.length - b.plates.length
    if (sort.key === 'lastVisit') return (a.lastVisit ?? '').localeCompare(b.lastVisit ?? '')
    return compareName(a, b)
  }
  return [...rows].sort((a, b) => sign * compare(a, b) || compareName(a, b))
}
