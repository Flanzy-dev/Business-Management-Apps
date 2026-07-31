// Decides which services to offer the cashier for the car on the lift. Pure —
// no store access, same as scheduleEngine.ts/orderLifecycle.ts: callers read
// the stores and pass arrays in, so every rule here is testable.
//
// The bar is deliberately high: a service is only suggested when a scheduled
// item has *passed* its mark and hasn't been changed yet. Nothing is proposed
// because it sold well or was bought last time.
import type { ServiceCatalogItem } from '../store/serviceCatalogStore'
import type { ServiceEvent } from '../store/serviceEventStore'
import type { WorkOrder, WorkOrderItem } from '../store/workOrderStore'
import type { DueLine } from './scheduleEngine'

export type SuggestionReason =
  /** Past a mark on the vehicle's live ScheduleRule for this item. */
  | { kind: 'overdue'; byKm: number }
  /** No rule for this item — measured from its last recorded change instead. */
  | { kind: 'interval_elapsed'; sinceKm: number }

export interface ServiceSuggestion {
  service: ServiceCatalogItem
  reason: SuggestionReason
}

/**
 * Odometer at which each item type was last *changed* on this vehicle, from its
 * recorded service history. A top-up is not a change (same rule
 * applyChangedServiceToSchedule follows), so it never resets the clock.
 */
export function lastChangeOdometerByItemType(events: ServiceEvent[]): Map<string, number> {
  const lastChange = new Map<string, number>()
  for (const event of events) {
    const odometer = event.odometerAtService ?? event.odometerAtArrival
    if (odometer == null) continue // an event with no reading can't date anything
    for (const item of event.items) {
      if (item.action !== 'changed') continue
      const known = lastChange.get(item.itemTypeId)
      if (known == null || odometer > known) lastChange.set(item.itemTypeId, odometer)
    }
  }
  return lastChange
}

/**
 * How often each service has been sold, keyed by line description. Completed
 * orders only — a quoted-then-abandoned ticket says nothing about what the
 * shop actually does. Used to order the catalog, never to suggest.
 */
export function serviceUsageCounts(orders: WorkOrder[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const order of orders) {
    if (order.status !== 'completed') continue
    for (const item of order.items) {
      if (item.productId) continue // parts are ranked by stock, not popularity
      counts.set(item.description, (counts.get(item.description) ?? 0) + 1)
    }
  }
  return counts
}

/** Catalog order for the services table: most-used first, ties keeping the shop's own order. */
export function rankServicesByUsage(
  services: ServiceCatalogItem[],
  usage: Map<string, number>
): ServiceCatalogItem[] {
  return services
    .map((service, index) => ({ service, index, count: usage.get(service.name) ?? 0 }))
    .sort((a, b) => b.count - a.count || a.index - b.index)
    .map(entry => entry.service)
}

/**
 * The suggested rows at the top of the services table.
 *
 * Two paths, in priority order:
 *   1. the vehicle has a live ScheduleRule for the item and the odometer is at
 *      or past its next mark;
 *   2. it has no rule, but its history says the item was last changed at least
 *      one default interval ago.
 * An item with neither a rule nor a recorded change has nothing to measure
 * from and is never suggested. Nor is an item the ticket is already changing.
 */
export function suggestServices({
  services,
  ticketItems,
  dueLines,
  currentOdometer,
  lastChangeByItemType,
  ruleItemTypeIds,
  intervalKmFor,
  limit = 4,
}: {
  services: ServiceCatalogItem[]
  ticketItems: WorkOrderItem[]
  /** From groupDueLines(liveRules, currentOdometer). */
  dueLines: DueLine[]
  currentOdometer: number
  lastChangeByItemType: Map<string, number>
  /** Item types with a live rule — they take path 1 and must not fall through to path 2. */
  ruleItemTypeIds: Set<string>
  intervalKmFor: (itemTypeId: string) => number
  limit?: number
}): ServiceSuggestion[] {
  // Only a tagged service can be "due"; plain labor has no schedule. An item
  // this ticket already carries is being changed right now, so drop it.
  const beingChanged = new Set(
    ticketItems.map(item => item.serviceItemTypeId).filter((id): id is string => !!id)
  )
  const candidates = services.filter(
    s => s.serviceItemTypeId && !beingChanged.has(s.serviceItemTypeId)
  )

  const overdue: ServiceSuggestion[] = []
  const elapsed: ServiceSuggestion[] = []
  const taken = new Set<string>()

  const push = (into: ServiceSuggestion[], service: ServiceCatalogItem, reason: SuggestionReason) => {
    if (taken.has(service.id)) return
    taken.add(service.id)
    into.push({ service, reason })
  }

  // Path 1 — past a scheduled mark. km-only for now (see scheduleEngine.ts's
  // date axis) — a month-only rule's line has no dueKm and is skipped here,
  // not suggested from calendar time yet.
  for (const line of dueLines) {
    if (line.dueKm == null) continue
    const byKm = currentOdometer - line.dueKm
    if (byKm < 0) continue // mark not reached yet; "due soon" is not a suggestion
    for (const itemTypeId of line.itemTypeIds) {
      for (const service of candidates.filter(s => s.serviceItemTypeId === itemTypeId)) {
        push(overdue, service, { kind: 'overdue', byKm })
      }
    }
  }

  // Path 2 — no rule, so measure from the last recorded change.
  for (const service of candidates) {
    const itemTypeId = service.serviceItemTypeId!
    if (ruleItemTypeIds.has(itemTypeId)) continue
    const lastChange = lastChangeByItemType.get(itemTypeId)
    if (lastChange == null) continue
    const sinceKm = currentOdometer - lastChange
    if (sinceKm < intervalKmFor(itemTypeId)) continue
    push(elapsed, service, { kind: 'interval_elapsed', sinceKm })
  }

  // Furthest past the mark leads, in both groups.
  overdue.sort((a, b) => (b.reason as { byKm: number }).byKm - (a.reason as { byKm: number }).byKm)
  elapsed.sort((a, b) => (b.reason as { sinceKm: number }).sinceKm - (a.reason as { sinceKm: number }).sinceKm)

  return [...overdue, ...elapsed].slice(0, limit)
}
