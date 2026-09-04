// One vehicle's past-visit history, derived from completed WorkOrders. Pure
// — no store access, callers pass arrays in — same discipline as
// src/lib/scheduleEngine.ts / reminders.ts / orderItemGroups.ts, so this is
// unit-testable and shareable between src/pages/ServiceHistory.tsx (the full
// page, with its chart and "last serviced by item type" schedule view) and
// src/components/vehicles/VehicleServiceHistoryDialog.tsx (the quick popup
// opened from a vehicle row's "..." menu). Both used to carry their own copy
// of this filter/sort and tag-label logic; extracted here so a fix to one
// can't silently miss the other.
import type { WorkOrder, WorkOrderItem } from '../store/workOrderStore'
import type { ServiceItemType } from '../store/serviceItemTypeStore'
import type { ServiceEvent } from '../store/serviceEventStore'

/**
 * Completed orders for one vehicle, newest first by completedAt (falling
 * back to createdAt for the rare case a completed order has no
 * completedAt). `taggedOnly` keeps only orders with at least one line tied
 * to a service item type — src/pages/ServiceHistory.tsx's own checkbox;
 * omit it for "everything," which is what the popup always wants.
 */
export function getCompletedOrdersForVehicle(
  workOrders: WorkOrder[],
  vehicleId: string,
  opts?: { taggedOnly?: boolean }
): WorkOrder[] {
  return workOrders
    .filter((wo) => wo.vehicleId === vehicleId && wo.status === 'completed')
    .filter((wo) => !opts?.taggedOnly || wo.items.some((i) => i.serviceItemTypeId))
    .sort((a, b) => new Date(b.completedAt || b.createdAt).getTime() - new Date(a.completedAt || a.createdAt).getTime())
}

/** Visit count + lifetime spend across a vehicle's history — the pair both
 *  ServiceHistory.tsx and VehicleServiceHistoryDialog show as stat tiles. */
export function serviceHistoryTotals(orders: WorkOrder[]): { totalVisits: number; totalSpent: number } {
  return {
    totalVisits: orders.length,
    totalSpent: orders.reduce((sum, wo) => sum + wo.total, 0),
  }
}

export interface LastServicedEntry {
  itemType: ServiceItemType
  date: string
  odometer: number | null
}

/**
 * Most recent ServiceEvent date/odometer per item type, for
 * ServiceHistory.tsx's "last serviced" summary — independent of the
 * tagged-only timeline filter that page's own checkbox applies to the order
 * list. Item types with no matching event are dropped, not returned with a
 * null date — the summary only ever shows ones it has an answer for.
 */
export function lastServicedByItemType(
  vehicleId: string,
  serviceItemTypes: ServiceItemType[],
  serviceEvents: ServiceEvent[]
): LastServicedEntry[] {
  return serviceItemTypes
    .map((itemType): LastServicedEntry | null => {
      const events = serviceEvents
        .filter((e) => e.vehicleId === vehicleId && e.items.some((i) => i.itemTypeId === itemType.id))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      const latest = events[0]
      if (!latest) return null
      return { itemType, date: latest.date, odometer: latest.odometerAtService ?? latest.odometerAtArrival }
    })
    .filter((x): x is LastServicedEntry => x !== null)
}

/**
 * "Oli Mesin · 3.5L · Topped up" for a line tied to a service item type, or
 * null for an ordinary (untagged) line — e.g. a part sold with no interval
 * tracking attached.
 */
export function serviceTagLabel(
  item: WorkOrderItem,
  itemTypeName: (id: string) => string,
  t: (path: string, vars?: Record<string, string | number>) => string
): string | null {
  if (!item.serviceItemTypeId) return null
  const liters = item.quantityLiters ? ` · ${item.quantityLiters}L` : ''
  const topped = item.serviceAction === 'topped_up' ? ` · ${t('serviceHistory.toppedUp')}` : ''
  return `${itemTypeName(item.serviceItemTypeId)}${liters}${topped}`
}
