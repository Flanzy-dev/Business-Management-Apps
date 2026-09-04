// The one mutation entry point for ScheduleRule changes — supersede-then-
// replace must never be split into two separate calls from a page or another
// op, or a rule could be "archived" without a live replacement ever landing.
//
// Stores arrive through `deps` (src/lib/ops/deps.ts); orderOps builds its own
// instance from the same deps so a test driving completeOrder sees the
// schedule move too. Named exports at the bottom keep call sites unchanged.
import { ScheduleRule, newestRule } from '../../store/scheduleRuleStore'
import { catalogDefaultRuleData, resolveDefaultCatalogMatch, scheduleRuleDataFromService, type ScheduleRuleWriteData } from '../serviceCatalog'
import { realOpsDeps, type OpsDeps } from './deps'

export type ScheduleOpsDeps = Pick<
  OpsDeps,
  'scheduleRules' | 'serviceCatalog' | 'serviceItemTypes' | 'settings' | 'now'
>

/** A brand-new rule for a customer-requested interval — no interval of its
 *  own to keep and no base to fall back on, so the reading this service
 *  happened at is its whole starting point. Pure. */
function customerRequestRuleData(requestedKm: number, newBaseOdometer: number | null | undefined): ScheduleRuleWriteData {
  return {
    intervalKm: requestedKm,
    baseOdometer: newBaseOdometer ?? 0,
    source: 'customer_request',
  }
}

/** Move an existing rule's base to where this service happened, keeping (or,
 *  if requested, overriding) its interval — the "active rule already exists"
 *  branch. Pure. */
function movedRuleData(
  active: ScheduleRule,
  update: { newBaseOdometer?: number | null; newBaseDate?: string | null },
  requested: number | null | undefined
): ScheduleRuleWriteData {
  const intervalKm = requested ?? active.intervalKm
  return {
    intervalKm,
    // Once an interval exists the base has to exist with it, or the rule
    // tracks a distance from nowhere — so a request arriving on a rule that
    // only tracked months starts its km axis here.
    baseOdometer: intervalKm != null && update.newBaseOdometer != null ? update.newBaseOdometer : active.baseOdometer,
    intervalMonths: active.intervalMonths,
    baseDate: active.intervalMonths != null && update.newBaseDate ? update.newBaseDate : active.baseDate,
    source: requested != null ? 'customer_request' : active.source,
  }
}

export function createScheduleOps(deps: ScheduleOpsDeps) {
  const today = () => deps.now().toISOString().slice(0, 10)

  /**
   * Create or replace the live schedule rule for a vehicle+item. Supersedes
   * *every* currently-live rule for the pair — not just one — and inserts a
   * new one chained back to the newest of them. Sync's per-row merge can
   * leave more than one rule live for the same pair (see
   * scheduleRuleStore.ts's interface doc comment); superseding all of them
   * here is what makes this call self-healing rather than just adding a
   * third live rule on top of an existing duplicate.
   */
  function setScheduleRule(
    vehicleId: string,
    itemTypeId: string,
    data: {
      intervalKm: number | null
      baseOdometer: number | null
      intervalMonths?: number | null
      baseDate?: string | null
      source: ScheduleRule['source']
      notes?: string
      sourceOrderId?: string | null
    }
  ): ScheduleRule {
    const store = deps.scheduleRules.getState()
    const activeRules = store.getActiveRules(vehicleId, itemTypeId)
    const active = newestRule(activeRules)
    if (activeRules.length > 0) store.supersedeRules(activeRules.map((r) => r.id))
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
      sourceOrderId: data.sourceOrderId ?? null,
      // Falls back to the superseded rule's own notes, not straight to '' —
      // scheduleDraftToRuleData (scheduleRuleForm.ts) has no notes field of
      // its own, so ScheduleRulesEditor's edit path used to silently wipe
      // whatever notes a rule already carried every time it was re-saved.
      notes: data.notes ?? active?.notes ?? '',
    })
  }

  /**
   * Stop tracking a schedule rule entirely — no replacement is inserted, so the
   * vehicle has no active rule for this item type until a new one is set.
   * Supersedes every live sibling for the same vehicle+item, not just the one
   * row the caller named — otherwise deleting the one visible duplicate would
   * leave an invisible live one behind (still counted by
   * deletionPolicy.ts's vehicleDeletionBlocker, still shadowing future saves).
   */
  function deleteScheduleRule(ruleId: string): void {
    const store = deps.scheduleRules.getState()
    const rule = store.getRule(ruleId)
    if (!rule) return
    const siblings = store.getActiveRules(rule.vehicleId, rule.itemTypeId)
    const ids = siblings.length > 0 ? siblings.map((r) => r.id) : [ruleId]
    store.supersedeRules(ids)
  }

  /**
   * Called from completeOrder for a tagged line with action:'changed' — moves
   * whichever axis this rule actually tracks (km, months, or both) to the
   * odometer/date the change happened at.
   *
   * `requestedIntervalKm` is the one case that always creates a rule outright:
   * the customer asked for their own interval at the counter ("kali ini 5.000
   * aja"). That is an instruction rather than something inferred from the
   * order, so it overrides the interval and marks the rule as theirs.
   *
   * A vehicle with no rule and no request *also* gets one created now — a
   * completed "changed" service is a fact about the car, not a guess from
   * order data, so there's no reason to leave it unscheduled just because
   * nobody had set one up. Sized from the catalog's real interval for this
   * item (resolveDefaultCatalogMatch — a months-only match like brake fluid
   * stays months-only, it doesn't gain a spurious km axis) when the item is
   * tagged to a catalog service at all; when it isn't, both axes fall back
   * to the shop-wide defaults together (settingsStore.ts's
   * defaultServiceIntervalKm/defaultServiceIntervalMonths — the same pairing
   * ScheduleRulesEditor's own manual setup falls back to).
   *
   * Either way the new/replaced rule is stamped with `orderId` so voiding or
   * deleting that order can find and unwind exactly this move — see
   * unwindScheduleForOrder below.
   */
  function applyChangedServiceToSchedule(
    vehicleId: string,
    itemTypeId: string,
    orderId: string,
    update: {
      newBaseOdometer?: number | null
      newBaseDate?: string | null
      requestedIntervalKm?: number | null
    }
  ): void {
    const requested = update.requestedIntervalKm
    const active = deps.scheduleRules.getState().getActiveRule(vehicleId, itemTypeId)

    // Pick which case applies, then write it through the one call below —
    // exactly one setScheduleRule per invocation, whichever branch runs.
    const data: ScheduleRuleWriteData = !active
      ? requested != null
        ? customerRequestRuleData(requested, update.newBaseOdometer)
        : catalogDefaultRuleData(
            deps.serviceCatalog.getState().services,
            deps.settings.getState().settings,
            itemTypeId,
            update,
            today()
          )
      : movedRuleData(active, update, requested)

    setScheduleRule(vehicleId, itemTypeId, { ...data, sourceOrderId: orderId, notes: active?.notes })
  }

  /**
   * Reverses the schedule moves applyChangedServiceToSchedule made for one
   * order — called when that order is voided or deleted (orderOps.ts). For
   * each of the order's rules that is *still* live: supersede it, then revive
   * its predecessor (supersedesId). Filtering to still-live rules is what
   * makes this safe to call on an older order after the car has been serviced
   * again — if a later order's service already superseded this one, it won't
   * be in this list, and that later rule is left untouched. A rule this order
   * created outright has no predecessor, so it simply stops being live,
   * leaving the vehicle with no rule for that item — as if this order had
   * never run.
   *
   * Revival is guarded: only when nothing else is live for that predecessor's
   * vehicle+item pair after the supersede above. Without this, reviving
   * unconditionally could resurrect a predecessor behind a rule another
   * device set for the same pair while this one was offline — exactly the
   * two-live-rules duplicate scheduleRuleStore.ts's invariant exists to rule
   * out. (This is the check that store's reviveRule doc comment already
   * describes as reviveRule's own contract; it belongs here, at the one
   * caller, not in the store action.)
   */
  function unwindScheduleForOrder(orderId: string): void {
    const store = deps.scheduleRules.getState()
    const fromThisOrder = store.scheduleRules.filter(
      (r) => r.sourceOrderId === orderId && r.supersededAt === null
    )
    for (const rule of fromThisOrder) {
      store.supersedeRule(rule.id)
      if (!rule.supersedesId) continue
      const stillLive = store.getActiveRules(rule.vehicleId, rule.itemTypeId)
      if (stillLive.length === 0) store.reviveRule(rule.supersedesId)
    }
  }

  /**
   * Called once, right after a new vehicle is created, for whichever item
   * types the Add Vehicle checklist left ticked. Seeds a live ScheduleRule
   * for each one that resolves to a catalog default (see
   * resolveDefaultCatalogMatch) — ambiguous or untagged types are silently
   * skipped, same as ScheduleRulesEditor's own auto-fill refusing to guess.
   * A vehicle with no odometer entered yet seeds base 0; the schedule
   * self-corrects the first time a real "changed" service completes (see
   * applyChangedServiceToSchedule).
   *
   * `itemTypeIds` filters which item types are even considered; omitting it
   * (every other caller today) seeds every item type that resolves a match,
   * same as before the checklist existed.
   */
  function seedDefaultScheduleRules(
    vehicleId: string,
    currentMileage: number | null,
    itemTypeIds?: string[]
  ): ScheduleRule[] {
    const services = deps.serviceCatalog.getState().services
    const allItemTypes = deps.serviceItemTypes.getState().serviceItemTypes
    const itemTypes = itemTypeIds ? allItemTypes.filter((it) => itemTypeIds.includes(it.id)) : allItemTypes
    const seeded: ScheduleRule[] = []
    for (const itemType of itemTypes) {
      const match = resolveDefaultCatalogMatch(services, itemType.id)
      if (!match) continue
      seeded.push(setScheduleRule(vehicleId, itemType.id, scheduleRuleDataFromService(match, currentMileage, today())))
    }
    return seeded
  }

  /**
   * Seed a live rule for exactly these catalog services — the Add Vehicle
   * Workshop Default checklist's ticked rows, keyed by service id rather than
   * item type so a shop can pick a specific candidate out of an
   * otherwise-ambiguous tag (see scheduleSetupCandidates, vehicleForm.ts)
   * instead of it being silently skipped. An id with no matching service, no
   * item type, or no interval is skipped rather than erroring — a stale tick
   * from a service deleted mid-form.
   */
  function seedScheduleRulesFromServices(
    vehicleId: string,
    currentMileage: number | null,
    serviceIds: string[]
  ): ScheduleRule[] {
    const services = deps.serviceCatalog.getState().services
    const seeded: ScheduleRule[] = []
    for (const id of serviceIds) {
      const service = services.find((s) => s.id === id)
      if (!service?.serviceItemTypeId || !(service.intervalKm || service.intervalMonths)) continue
      seeded.push(setScheduleRule(vehicleId, service.serviceItemTypeId, scheduleRuleDataFromService(service, currentMileage, today())))
    }
    return seeded
  }

  return {
    setScheduleRule,
    deleteScheduleRule,
    applyChangedServiceToSchedule,
    unwindScheduleForOrder,
    seedDefaultScheduleRules,
    seedScheduleRulesFromServices,
  }
}

// The one real instance the running app uses.
const defaultOps = createScheduleOps(realOpsDeps)

export const setScheduleRule = defaultOps.setScheduleRule
export const deleteScheduleRule = defaultOps.deleteScheduleRule
// No bound seedDefaultScheduleRules/applyChangedServiceToSchedule/unwindScheduleForOrder:
// entityOps.ts and orderOps.ts each build their own instance via createScheduleOps(deps)
// so entity creation, completion/void/delete, and schedule bookkeeping all share one
// dependency set. Pages never call any of the three directly.
