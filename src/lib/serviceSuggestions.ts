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
import type { ScheduleRule } from '../store/scheduleRuleStore'
import type { DueLine } from './scheduleEngine'
import { dueDateTone, groupDueLines } from './scheduleEngine'

/** Calendar days a date-axis mark has already passed — same math dueDateTone
 *  uses to decide 'overdue' in the first place, so the two never disagree. */
function daysPastDueDate(dueDate: string, currentDate: Date): number {
  const [year, month, day] = dueDate.slice(0, 10).split('-').map(Number)
  const due = new Date(year, month - 1, day)
  return Math.round((currentDate.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))
}

export type SuggestionReason =
  /** Past a mark on the vehicle's live ScheduleRule for this item, by km. */
  | { kind: 'overdue'; byKm: number }
  /** Past a mark on the vehicle's live ScheduleRule for this item, by date —
   *  the calendar-time counterpart to 'overdue', for a months-tracked rule
   *  (e.g. brake fluid every 24 months) that has no km axis to measure. */
  | { kind: 'overdue_date'; byDays: number }
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

/** Candidates keyed by schedule tag — was a `.filter()` re-scan of the whole
 *  candidate list per itemTypeId, per dueLine, an O(n·m) scan for what's
 *  really a lookup. Built once per suggestServices call. */
function servicesByItemType(candidates: ServiceCatalogItem[]): Map<string, ServiceCatalogItem[]> {
  const byType = new Map<string, ServiceCatalogItem[]>()
  for (const service of candidates) {
    const itemTypeId = service.serviceItemTypeId!
    const list = byType.get(itemTypeId)
    if (list) list.push(service)
    else byType.set(itemTypeId, [service])
  }
  return byType
}

/**
 * Path 1 — past a scheduled mark, by km. `taken` is shared across all three
 * collectors and mutated as each suggestion is claimed, so calling km, then
 * date, then elapsed in that order is what makes km→date→elapsed the actual
 * priority: a service already claimed here is skipped by the later two.
 */
function collectOverdueByKm(
  dueLines: DueLine[],
  currentOdometer: number,
  byType: Map<string, ServiceCatalogItem[]>,
  taken: Set<string>
): ServiceSuggestion[] {
  const out: ServiceSuggestion[] = []
  for (const line of dueLines) {
    if (line.dueKm == null) continue
    const byKm = currentOdometer - line.dueKm
    if (byKm < 0) continue // mark not reached yet; "due soon" is not a suggestion
    for (const itemTypeId of line.itemTypeIds) {
      for (const service of byType.get(itemTypeId) ?? []) {
        if (taken.has(service.id)) continue
        taken.add(service.id)
        out.push({ service, reason: { kind: 'overdue', byKm } })
      }
    }
  }
  return out
}

/**
 * Path 2 — past a scheduled mark, by date. A line already claimed by path 1
 * (same itemTypeId) is skipped via `taken`, so a both-axes rule overdue on
 * both counts is only ever suggested once, as the km reason.
 */
function collectOverdueByDate(
  dueLines: DueLine[],
  currentDate: Date,
  byType: Map<string, ServiceCatalogItem[]>,
  taken: Set<string>
): ServiceSuggestion[] {
  const out: ServiceSuggestion[] = []
  for (const line of dueLines) {
    if (line.dueDate == null) continue
    if (dueDateTone(line.dueDate, currentDate) !== 'overdue') continue // "due soon" is not a suggestion
    const byDays = daysPastDueDate(line.dueDate, currentDate)
    for (const itemTypeId of line.itemTypeIds) {
      for (const service of byType.get(itemTypeId) ?? []) {
        if (taken.has(service.id)) continue
        taken.add(service.id)
        out.push({ service, reason: { kind: 'overdue_date', byDays } })
      }
    }
  }
  return out
}

/** Path 3 — no rule, so measure from the last recorded change. */
function collectIntervalElapsed(
  candidates: ServiceCatalogItem[],
  ruleItemTypeIds: Set<string>,
  lastChangeByItemType: Map<string, number>,
  currentOdometer: number,
  intervalKmFor: (itemTypeId: string) => number,
  taken: Set<string>
): ServiceSuggestion[] {
  const out: ServiceSuggestion[] = []
  for (const service of candidates) {
    if (taken.has(service.id)) continue
    const itemTypeId = service.serviceItemTypeId!
    if (ruleItemTypeIds.has(itemTypeId)) continue
    const lastChange = lastChangeByItemType.get(itemTypeId)
    if (lastChange == null) continue
    const sinceKm = currentOdometer - lastChange
    if (sinceKm < intervalKmFor(itemTypeId)) continue
    taken.add(service.id)
    out.push({ service, reason: { kind: 'interval_elapsed', sinceKm } })
  }
  return out
}

/**
 * The suggested rows at the top of the services table.
 *
 * Three paths, in priority order:
 *   1. the vehicle has a live ScheduleRule for the item and the odometer is at
 *      or past its next km mark;
 *   2. it has a live ScheduleRule tracking calendar time and today is at or
 *      past its next date mark — the "whichever comes first" contract
 *      vehicleDueSummary.ts's badge already applies, extended here so a
 *      months-only rule (no km axis at all, e.g. brake fluid every 24 months)
 *      can be suggested too, not just badged;
 *   3. it has no rule, but its history says the item was last changed at least
 *      one default interval ago.
 * An item with neither a rule nor a recorded change has nothing to measure
 * from and is never suggested. Nor is an item the ticket is already changing.
 */
export function suggestServices({
  services,
  ticketItems,
  dueLines,
  currentOdometer,
  currentDate,
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
  currentDate: Date
  lastChangeByItemType: Map<string, number>
  /** Item types with a live rule — they take paths 1/2 and must not fall through to path 3. */
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
  const byType = servicesByItemType(candidates)
  const taken = new Set<string>()

  const overdueKm = collectOverdueByKm(dueLines, currentOdometer, byType, taken)
  const overdueDate = collectOverdueByDate(dueLines, currentDate, byType, taken)
  const elapsed = collectIntervalElapsed(candidates, ruleItemTypeIds, lastChangeByItemType, currentOdometer, intervalKmFor, taken)

  // Furthest past the mark leads, within each group. Sorting after dedupe
  // (not before) means a taken item never reaches the sort at all — same
  // behavior either way here, but the one place a careless reordering of
  // these two steps would change output.
  overdueKm.sort((a, b) => (b.reason as { byKm: number }).byKm - (a.reason as { byKm: number }).byKm)
  overdueDate.sort((a, b) => (b.reason as { byDays: number }).byDays - (a.reason as { byDays: number }).byDays)
  elapsed.sort((a, b) => (b.reason as { sinceKm: number }).sinceKm - (a.reason as { sinceKm: number }).sinceKm)

  return [...overdueKm, ...overdueDate, ...elapsed].slice(0, limit)
}

/**
 * The subset of suggestServices' output that Reminders.tsx would also call
 * "overdue" on this vehicle — km-past-mark or date-past-mark only. Used to
 * auto-add a line when a work order is started from an overdue Reminders
 * row (see NewWorkOrderDialog.tsx); "due soon" and interval-elapsed (no live
 * rule) are excluded, since neither is what Reminders flags as overdue.
 */
export function overdueServiceSuggestions(
  services: ServiceCatalogItem[],
  liveRules: ScheduleRule[],
  currentOdometer: number,
  currentDate: Date
): ServiceSuggestion[] {
  return suggestServices({
    services,
    ticketItems: [],
    dueLines: groupDueLines(liveRules),
    currentOdometer,
    currentDate,
    lastChangeByItemType: new Map(),
    ruleItemTypeIds: new Set(liveRules.map((r) => r.itemTypeId)),
    intervalKmFor: () => Infinity,
    limit: Infinity,
  }).filter((s) => s.reason.kind === 'overdue' || s.reason.kind === 'overdue_date')
}
