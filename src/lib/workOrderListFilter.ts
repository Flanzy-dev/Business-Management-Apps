// WorkOrderList's tab-filter + free-text search, pulled out of the useMemo
// body — same "real rules belong in a plain .ts, not a component body"
// reasoning as every other *Form.ts-shaped module in this codebase.
import type { WorkOrder } from '../store/workOrderStore'
import { isUnpaidCompleted } from './receivables'

export type WorkOrderListTab = 'all' | 'open' | 'pending' | 'completed'

function matchesTab(wo: WorkOrder, tab: WorkOrderListTab): boolean {
  if (tab === 'open') return wo.status === 'open'
  if (tab === 'pending') return isUnpaidCompleted(wo)
  if (tab === 'completed') return wo.status === 'completed' && !isUnpaidCompleted(wo)
  return true
}

/** Everything a search hit can match, already resolved by the caller (owner
 *  name/vehicle/plate/worker all come from directory maps the component
 *  builds once per render, not per order). */
export interface WorkOrderSearchFields {
  ownerName: string
  vehicleDisplay: string
  vehiclePlate: string
  workerName: string
}

function matchesQuery(wo: WorkOrder, q: string, fields: WorkOrderSearchFields): boolean {
  if (!q) return true
  return (
    String(wo.orderNumber).includes(q) ||
    `sb-${wo.orderNumber}`.includes(q) ||
    fields.ownerName.toLowerCase().includes(q) ||
    fields.vehicleDisplay.toLowerCase().includes(q) ||
    fields.vehiclePlate.toLowerCase().includes(q) ||
    fields.workerName.toLowerCase().includes(q)
  )
}

export interface WorkOrderTabCounts {
  all: number
  open: number
  pending: number
  completed: number
}

/** The count badge on each tab — "completed" deliberately excludes an unpaid
 *  one (that's "pending"'s count instead), same split matchesTab uses. */
export function workOrderTabCounts(orders: WorkOrder[]): WorkOrderTabCounts {
  return {
    all: orders.length,
    open: orders.filter((wo) => wo.status === 'open').length,
    pending: orders.filter(isUnpaidCompleted).length,
    completed: orders.filter((wo) => wo.status === 'completed' && !isUnpaidCompleted(wo)).length,
  }
}

/** Tab filter -> free-text search -> newest first. */
export function filterWorkOrderList(
  orders: WorkOrder[],
  tab: WorkOrderListTab,
  query: string,
  searchFieldsFor: (wo: WorkOrder) => WorkOrderSearchFields
): WorkOrder[] {
  const q = query.trim().toLowerCase()
  return orders
    .filter((wo) => matchesTab(wo, tab))
    .filter((wo) => matchesQuery(wo, q, searchFieldsFor(wo)))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}
