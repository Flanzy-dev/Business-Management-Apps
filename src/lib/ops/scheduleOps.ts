// The one mutation entry point for ScheduleRule changes — supersede-then-
// replace must never be split into two separate calls from a page or another
// op, or a rule could be "archived" without a live replacement ever landing.
import { useScheduleRuleStore, ScheduleRule } from '../../store/scheduleRuleStore'
import { useServiceCatalogStore } from '../../store/serviceCatalogStore'
import { useServiceItemTypeStore } from '../../store/serviceItemTypeStore'
import { resolveDefaultCatalogMatch } from '../serviceCatalog'

const today = () => new Date().toISOString().slice(0, 10)

/**
 * Create or replace the live schedule rule for a vehicle+item. Supersedes the
 * current live rule (if any) and inserts a new one pointing back to it.
 */
export function setScheduleRule(
  vehicleId: string,
  itemTypeId: string,
  data: {
    intervalKm: number | null
    baseOdometer: number | null
    intervalMonths?: number | null
    baseDate?: string | null
    source: ScheduleRule['source']
    notes?: string
  }
): ScheduleRule {
  const store = useScheduleRuleStore.getState()
  const active = store.getActiveRule(vehicleId, itemTypeId)
  if (active) store.supersedeRule(active.id)
  return store.addRule({
    vehicleId,
    itemTypeId,
    intervalKm: data.intervalKm,
    baseOdometer: data.baseOdometer,
    intervalMonths: data.intervalMonths ?? null,
    baseDate: data.baseDate ?? null,
    source: data.source,
    supersededAt: null,
    supersedesId: active?.id ?? null,
    notes: data.notes ?? '',
  })
}

/**
 * Stop tracking a schedule rule entirely — no replacement is inserted, so the
 * vehicle has no active rule for this item type until a new one is set.
 */
export function deleteScheduleRule(ruleId: string): void {
  useScheduleRuleStore.getState().supersedeRule(ruleId)
}

/**
 * Called from completeOrder for a tagged line with action:'changed' — moves
 * whichever axis this rule actually tracks (km, months, or both) to the
 * odometer/date the change happened at. No-ops if no rule exists yet for
 * this vehicle+item; never fabricates one from order data.
 */
export function applyChangedServiceToSchedule(
  vehicleId: string,
  itemTypeId: string,
  update: { newBaseOdometer?: number | null; newBaseDate?: string | null }
): void {
  const active = useScheduleRuleStore.getState().getActiveRule(vehicleId, itemTypeId)
  if (!active) return
  setScheduleRule(vehicleId, itemTypeId, {
    intervalKm: active.intervalKm,
    baseOdometer: active.intervalKm != null && update.newBaseOdometer != null ? update.newBaseOdometer : active.baseOdometer,
    intervalMonths: active.intervalMonths,
    baseDate: active.intervalMonths != null && update.newBaseDate ? update.newBaseDate : active.baseDate,
    source: active.source,
    notes: active.notes,
  })
}

/**
 * Called once, right after a new vehicle is created (when the shop picked
 * "Workshop Default" over "Custom" in the Add Vehicle form). Seeds a live
 * ScheduleRule for every ServiceItemType that resolves to a catalog default
 * (see resolveDefaultCatalogMatch) — ambiguous or untagged types are
 * silently skipped, same as ManageScheduleDialog's own auto-fill refusing to
 * guess. A vehicle with no odometer entered yet seeds base 0; the schedule
 * self-corrects the first time a real "changed" service completes (see
 * applyChangedServiceToSchedule).
 */
export function seedDefaultScheduleRules(vehicleId: string, currentMileage: number | null): ScheduleRule[] {
  const services = useServiceCatalogStore.getState().services
  const itemTypes = useServiceItemTypeStore.getState().serviceItemTypes
  const seeded: ScheduleRule[] = []
  for (const itemType of itemTypes) {
    const match = resolveDefaultCatalogMatch(services, itemType.id)
    if (!match) continue
    seeded.push(
      setScheduleRule(vehicleId, itemType.id, {
        intervalKm: match.intervalKm ?? null,
        baseOdometer: match.intervalKm ? currentMileage ?? 0 : null,
        intervalMonths: match.intervalMonths ?? null,
        baseDate: match.intervalMonths ? today() : null,
        source: 'workshop_default',
      })
    )
  }
  return seeded
}
