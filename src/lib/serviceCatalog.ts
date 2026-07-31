// Maps a service price-list entry onto a work-order line. Pure; kept out of
// the checkout component because the schedule-tag half of this mapping is what
// feeds ServiceEvent/ScheduleRule on completion (see serviceEventLifecycle.ts)
// — a silent mistake here shifts a vehicle's next-due odometer.
import type { ServiceCatalogItem } from '../store/serviceCatalogStore'
import type { WorkOrderItem } from '../store/workOrderStore'

/**
 * Ticket line for a catalog service. Never stock-linked (`productId: null`) —
 * that's what keeps it out of parts revenue and under Services on the receipt.
 * An entry linked to a service item type produces a line already tagged as a
 * "changed" service; an unlinked one produces a plain labor line carrying no
 * schedule fields at all.
 */
export function serviceCatalogLine(service: ServiceCatalogItem): Omit<WorkOrderItem, 'id' | 'lineTotal'> {
  const line: Omit<WorkOrderItem, 'id' | 'lineTotal'> = {
    description: service.name,
    quantity: 1,
    unitPrice: service.price,
    productId: null,
  }
  if (!service.serviceItemTypeId) return line
  return {
    ...line,
    serviceItemTypeId: service.serviceItemTypeId,
    serviceAction: 'changed',
    quantityLiters: null,
    containerType: null,
  }
}

/**
 * Which catalog service defines the default interval for a schedule tag —
 * the single candidate if there's only one, the shop's explicit pick
 * (isDefaultForItemType) if there are several, or null if it's ambiguous and
 * nothing has been marked. Used to auto-fill a schedule rule's interval
 * (Manage Schedule's own auto-fill, and seedDefaultScheduleRules for a new
 * vehicle) without ever guessing between two candidates.
 */
export function resolveDefaultCatalogMatch(services: ServiceCatalogItem[], itemTypeId: string): ServiceCatalogItem | null {
  const candidates = services.filter((s) => s.serviceItemTypeId === itemTypeId && (s.intervalKm || s.intervalMonths))
  return candidates.length === 1 ? candidates[0] : candidates.find((c) => c.isDefaultForItemType) ?? null
}
