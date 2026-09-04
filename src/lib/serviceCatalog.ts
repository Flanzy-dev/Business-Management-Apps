// Maps a service price-list entry onto a work-order line. Pure; kept out of
// the checkout component because the schedule-tag half of this mapping is what
// feeds ServiceEvent/ScheduleRule on completion (see serviceEventLifecycle.ts)
// — a silent mistake here shifts a vehicle's next-due odometer. This file also
// hosts the Add/Edit Service dialog's own derivation logic (axis-gated
// interval parsing) — same "real rules belong in a plain .ts, not a component
// body" reasoning as vehicleForm.ts — so ServiceFormDialog.tsx calls in
// rather than duplicating them.
import type { ServiceCatalogItem } from '../store/serviceCatalogStore'
import type { WorkOrderItem } from '../store/workOrderStore'
import { intervalAxisOf, type IntervalAxis } from './entities'
import { DEFAULT_SERVICE_INTERVAL_KM, DEFAULT_SERVICE_INTERVAL_MONTHS } from '../store/settingsStore'

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
    kind: 'service',
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
 * the single candidate if there's only one, or null if it's ambiguous (several
 * candidates share the tag). Used to auto-fill a schedule rule's interval
 * (ScheduleRulesEditor's own auto-fill, and seedDefaultScheduleRules for a new
 * vehicle) without ever guessing between two candidates.
 */
export function resolveDefaultCatalogMatch(services: ServiceCatalogItem[], itemTypeId: string): ServiceCatalogItem | null {
  const candidates = services.filter((s) => s.serviceItemTypeId === itemTypeId && (s.intervalKm || s.intervalMonths))
  return candidates.length === 1 ? candidates[0] : null
}

/** What setScheduleRule needs to seed a rule straight from one catalog
 *  service's own interval — shared by seedDefaultScheduleRules (item-type
 *  based) and seedScheduleRulesFromServices (explicit-service based, the Add
 *  Vehicle Workshop Default checklist — see scheduleOps.ts). */
export function scheduleRuleDataFromService(
  service: ServiceCatalogItem,
  currentMileage: number | null,
  today: string
): ScheduleRuleWriteData {
  return {
    intervalKm: service.intervalKm ?? null,
    baseOdometer: service.intervalKm ? currentMileage ?? 0 : null,
    intervalMonths: service.intervalMonths ?? null,
    baseDate: service.intervalMonths ? today : null,
    source: 'workshop_default',
  }
}

/** What setScheduleRule (scheduleOps.ts) needs to create or move a rule —
 *  matches its own `data` parameter shape, minus vehicleId/itemTypeId. */
export interface ScheduleRuleWriteData {
  intervalKm: number | null
  baseOdometer: number | null
  intervalMonths?: number | null
  baseDate?: string | null
  source: 'workshop_default' | 'customer_request'
  sourceOrderId?: string | null
}

/**
 * A brand-new schedule rule for a "changed" service with no customer-requested
 * interval — pulled out of scheduleOps.ts's applyChangedServiceToSchedule as a
 * pure function, since it touches no store, only the services array and
 * settings object its one caller already read. Sized from the catalog's real
 * per-item interval when this item type resolves to one (a months-only match
 * like brake fluid stays months-only, never gaining a spurious km axis); the
 * shop-wide km/months pair only steps in when there's no catalog match at
 * all. Which axis is actually live (intervalAxisOf — truthiness-based, 0
 * counts as unset, same convention scheduleRuleForm.ts's
 * scheduleDraftToRuleData uses) decides whether that axis's base gets
 * written.
 */
export function catalogDefaultRuleData(
  services: ServiceCatalogItem[],
  settings: { defaultServiceIntervalKm?: number; defaultServiceIntervalMonths?: number },
  itemTypeId: string,
  update: { newBaseOdometer?: number | null; newBaseDate?: string | null },
  today: string
): ScheduleRuleWriteData {
  const match = resolveDefaultCatalogMatch(services, itemTypeId)
  const intervalKm = match ? match.intervalKm ?? null : settings.defaultServiceIntervalKm ?? DEFAULT_SERVICE_INTERVAL_KM
  const intervalMonths = match ? match.intervalMonths ?? null : settings.defaultServiceIntervalMonths ?? DEFAULT_SERVICE_INTERVAL_MONTHS
  const axis = intervalAxisOf(intervalKm, intervalMonths)
  const usesKm = axis === 'km' || axis === 'both'
  const usesMonths = axis === 'months' || axis === 'both'
  return {
    intervalKm: usesKm ? intervalKm : null,
    baseOdometer: usesKm ? update.newBaseOdometer ?? 0 : null,
    intervalMonths: usesMonths ? intervalMonths : null,
    baseDate: usesMonths ? update.newBaseDate ?? today : null,
    source: 'workshop_default',
  }
}

/**
 * The real km interval for this item type — resolveDefaultCatalogMatch's
 * answer when it has one (brake fluid's 40,000 km, not the shop's generic
 * oil-change default), falling back to `fallback` (normally
 * settings.defaultServiceIntervalKm) only when the catalog can't answer
 * (ambiguous, untagged, or no km axis at all). Used to seed a new schedule
 * rule (scheduleOps.ts) and to size checkout suggestions (serviceSuggestions.ts)
 * per item type instead of a single shop-wide number for everything.
 */
export function catalogIntervalKmFor(
  services: ServiceCatalogItem[],
  itemTypeId: string,
  fallback: number
): number {
  return resolveDefaultCatalogMatch(services, itemTypeId)?.intervalKm ?? fallback
}

/**
 * The Add/Edit Service dialog's Track-by picker gates which of the two typed
 * interval strings are even eligible to be saved — switching the axis away
 * doesn't clear the other field's typed value, so save must still leave it
 * out. Parse-or-null, not parse-or-zero (unlike price): 0 isn't a meaningful
 * interval, and blank should mean "no default set" — stays "-" in the table
 * rather than reading as "due immediately".
 */
export function catalogDraftIntervals(
  axis: IntervalAxis,
  intervalKmText: string,
  intervalMonthsText: string
): { intervalKm: number | null; intervalMonths: number | null } {
  return {
    intervalKm: (axis === 'km' || axis === 'both') && intervalKmText ? Math.round(parseFloat(intervalKmText)) : null,
    intervalMonths:
      (axis === 'months' || axis === 'both') && intervalMonthsText ? Math.round(parseFloat(intervalMonthsText)) : null,
  }
}

/** No schedule tag selected — the Add/Edit Service dialog's own sentinel for
 *  ServiceCatalogItem.serviceItemTypeId's `null` in <select>-friendly form. */
export const NO_SCHEDULE_TAG = ''

export interface ServiceCatalogDraft {
  name: string
  price: string
  /** NO_SCHEDULE_TAG, or a real ServiceItemType id. */
  serviceItemTypeId: string
  intervalAxis: IntervalAxis
  intervalKm: string
  intervalMonths: string
  notes: string
}

/** Where the Add/Edit Service form starts: an existing entry's values when
 *  editing; blank for a new one, except price, which starts at '0' rather
 *  than an empty box — still fully editable, just not blank while the shop
 *  types over it. */
export function initialCatalogDraft(service: ServiceCatalogItem | null): ServiceCatalogDraft {
  return {
    name: service?.name ?? '',
    price: service ? String(service.price) : '0',
    serviceItemTypeId: service?.serviceItemTypeId ?? NO_SCHEDULE_TAG,
    intervalAxis: intervalAxisOf(service?.intervalKm, service?.intervalMonths),
    intervalKm: service?.intervalKm ? String(service.intervalKm) : '',
    intervalMonths: service?.intervalMonths ? String(service.intervalMonths) : '',
    notes: service?.notes ?? '',
  }
}

/** The stored-shape fields both addService and updateService take. */
export function catalogDraftToData(draft: ServiceCatalogDraft): Omit<ServiceCatalogItem, 'id' | 'createdAt'> {
  return {
    name: draft.name.trim(),
    price: Math.round(parseFloat(draft.price) || 0),
    serviceItemTypeId: draft.serviceItemTypeId || null,
    ...catalogDraftIntervals(draft.intervalAxis, draft.intervalKm, draft.intervalMonths),
    notes: draft.notes,
  }
}

/**
 * A tagged service is precisely the one that wants a reminder interval —
 * picking a schedule tag only ever flips the axis away from "no reminder",
 * never overrides a choice already made (e.g. re-tagging a deliberately
 * time-only entry shouldn't jump it to km).
 */
export function axisOnTagChange(newTagId: string, currentAxis: IntervalAxis): IntervalAxis {
  return newTagId && currentAxis === 'none' ? 'km' : currentAxis
}
