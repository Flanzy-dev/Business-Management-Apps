// One-time cleanup for ScheduleRule rows left behind by the service-item-type
// reseed bug: DEFAULT_SERVICE_ITEM_TYPES (serviceItemTypeStore.ts) used to
// hand every built-in item type a fresh newEntity() id on every launch that
// found nothing persisted yet — which is every launch until a shop happens to
// rename/add/delete one, since zustand's persist only writes on a real
// mutation. Each such reseed orphaned every ScheduleRule.itemTypeId written
// against the *previous* seed: it stopped matching anything in the current
// serviceItemTypeStore, so ScheduleRulesEditor showed it as an unresolvable
// "Unknown" row sitting alongside the real one the user just (re)created for
// what was, to them, the same item type — looking exactly like the item
// type's schedule "duplicating" instead of being edited in place.
//
// serviceItemTypeStore.ts now seeds deterministic ids (seededId, lib/id.ts),
// so this stops recurring going forward. This is the once-only repair for
// whatever a shop already accumulated before that fix: any live rule whose
// itemTypeId matches no current item type can never be resolved to a name
// again (the old random id carried no information about which of the seven
// it used to mean — see seededId's doc comment), so the only sound recovery
// is to stop it from sitting there as a phantom "Unknown" row. Superseding it
// (not deleting) keeps the audit trail intact, same as every other rule
// archival in this file's sibling, scheduleOps.ts.
//
// Same createXOps(deps) + bound-default shape as costingBackfill.ts, for the
// same reason: a migration that runs once against real user data needs to be
// exercisable from a fake, not just trusted to work.
import { realOpsDeps, type OpsDeps } from './deps'

export type ScheduleRuleOrphanRepairOpsDeps = Pick<OpsDeps, 'scheduleRules' | 'serviceItemTypes' | 'now'>

export function createScheduleRuleOrphanRepairOps(deps: ScheduleRuleOrphanRepairOpsDeps) {
  /**
   * Supersede every live schedule rule whose itemTypeId matches no current
   * service item type. No-op once `orphanRepairedAt` is set — skips anything
   * already done, so a crash part-way through simply re-runs on next launch,
   * and running it again after the first successful pass finds nothing left
   * to do either way.
   */
  function repairOrphanedScheduleRules(): void {
    const store = deps.scheduleRules.getState()
    if (store.orphanRepairedAt) return

    const knownItemTypeIds = new Set(deps.serviceItemTypes.getState().serviceItemTypes.map((it) => it.id))
    const orphaned = store.scheduleRules.filter(
      (r) => r.supersededAt === null && !knownItemTypeIds.has(r.itemTypeId)
    )
    if (orphaned.length > 0) store.supersedeRules(orphaned.map((r) => r.id))

    store.markOrphanRepaired(deps.now().toISOString())
  }

  return { repairOrphanedScheduleRules }
}

// The one real instance the running app uses.
const defaultOps = createScheduleRuleOrphanRepairOps(realOpsDeps)

export const repairOrphanedScheduleRules = defaultOps.repairOrphanedScheduleRules
