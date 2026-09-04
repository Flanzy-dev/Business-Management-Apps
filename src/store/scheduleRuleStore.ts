import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { newEntity, updateById, findById } from './entityHelpers'
import { getStorageAdapter } from '../lib/storageAdapter'

export interface ScheduleRule {
  id: string
  vehicleId: string
  itemTypeId: string
  // null means this rule doesn't track that axis. A rule must track at
  // least one of km/months (enforced by ScheduleRulesEditor, not here —
  // same as this store never validating intervalKm > 0 either).
  intervalKm: number | null
  baseOdometer: number | null
  // Optional key (not just nullable) — this store isn't versioned/migrated,
  // so existing persisted rules simply won't have these at all, same
  // convention as ServiceCatalogItem.intervalKm.
  intervalMonths?: number | null
  baseDate?: string | null // 'YYYY-MM-DD', same convention as Expense.date
  source: 'workshop_default' | 'customer_request'
  supersededAt: string | null // null = the live rule for this vehicle+item
  supersedesId: string | null // audit chain back to the rule this replaced
  // The completed work order whose "changed" service moved this rule to its
  // current base — set by applyChangedServiceToSchedule (scheduleOps.ts),
  // absent for a rule set directly via ScheduleRulesEditor or seeded for a
  // new vehicle. What lets voiding/deleting that order find and unwind the
  // move it caused (see scheduleOps.ts's unwindScheduleForOrder). Optional
  // key, not a migrated one — same convention as intervalMonths above.
  sourceOrderId?: string | null
  notes: string
  createdAt: string
}

// Rules are never edited in place — see src/lib/ops/scheduleOps.ts, the only
// place that should call addRule/supersede together, so "archive old, insert
// replacement" can never be split into two separate mutations.
//
// "At most one live rule per vehicle+item type" is a cross-row invariant, and
// the LAN sync merge (src/lib/sync/merge.ts) resolves conflicts per row id,
// with no notion of an invariant spanning rows — two devices independently
// superseding the same rule and each inserting their own replacement both
// land as live. So this invariant is CONVERGED TO by every write, not
// assumed true going in: setScheduleRule (scheduleOps.ts) supersedes every
// live rule it finds for a pair, not just one, and every reader collapses to
// a single deterministic winner (newestRule below) rather than trusting
// there's only one. See src/lib/scheduleEngine.ts's activeRulesForVehicle.
interface ScheduleRuleStore {
  scheduleRules: ScheduleRule[]
  // Set once the one-time orphaned-rule cleanup has run — see
  // src/lib/ops/scheduleRuleOrphanRepair.ts. Same marker-field convention as
  // stockLotStore's backfilledAt/markBackfilled.
  orphanRepairedAt: string | null
  markOrphanRepaired: (at: string) => void
  addRule: (data: Omit<ScheduleRule, 'id' | 'createdAt'>) => ScheduleRule
  supersedeRule: (id: string) => void
  // Supersedes every id in one `set` — one persist write, one sync diff (see
  // src/lib/sync/tracker.ts), instead of one write per duplicate. Use this
  // over calling supersedeRule in a loop whenever more than one rule might
  // need archiving at once (setScheduleRule, deleteScheduleRule).
  supersedeRules: (ids: string[]) => void
  // The exact inverse of supersedeRule — clears supersededAt so a rule
  // becomes live again. Only scheduleOps.ts's unwindScheduleForOrder should
  // call this, and only on a rule that is nobody else's live rule right now
  // (see that function for the check) — reviving one behind an existing live
  // rule for the same vehicle+item would leave two "live" rules at once.
  reviveRule: (id: string) => void
  getRule: (id: string) => ScheduleRule | undefined
  getRulesByVehicle: (vehicleId: string) => ScheduleRule[]
  // The deterministic winner if more than one live rule exists for the pair
  // (see the invariant note above) — never assumes there's exactly one.
  getActiveRule: (vehicleId: string, itemTypeId: string) => ScheduleRule | undefined
  // Every live rule for the pair, not just the winner — what a write has to
  // supersede *all* of to actually collapse a duplicate back to one.
  getActiveRules: (vehicleId: string, itemTypeId: string) => ScheduleRule[]
}

/**
 * The deterministic winner among rules assumed to be live for the same
 * vehicle+item type — every device must agree on this or duplicates never
 * converge. Newest `createdAt` wins; `id` (also replicated, also stable)
 * breaks a tie. Shared by getActiveRule, scheduleOps.ts's setScheduleRule
 * (which chains supersedesId to whichever one this picks), and the v1
 * migration below, so all three can never disagree about which rule is "the"
 * one.
 */
export function newestRule(rules: ScheduleRule[]): ScheduleRule | undefined {
  return rules.reduce<ScheduleRule | undefined>((winner, r) => {
    if (!winner) return r
    if (r.createdAt !== winner.createdAt) return r.createdAt > winner.createdAt ? r : winner
    return r.id > winner.id ? r : winner
  }, undefined)
}

/** Collapse every vehicle+item-type pair with more than one live rule down
 *  to newestRule's winner — the v0->v1 migration below, pulled out so a test
 *  can drive it on plain data with no persist machinery. Rules with no live
 *  duplicate (the overwhelming majority) pass through untouched. */
export function collapseDuplicateLiveRules(rules: ScheduleRule[]): ScheduleRule[] {
  const liveByPair = new Map<string, ScheduleRule[]>()
  for (const r of rules) {
    if (r.supersededAt !== null) continue
    const key = `${r.vehicleId}|${r.itemTypeId}`
    const group = liveByPair.get(key)
    if (group) group.push(r)
    else liveByPair.set(key, [r])
  }

  const loserIds = new Set<string>()
  for (const group of liveByPair.values()) {
    if (group.length < 2) continue
    const winner = newestRule(group)
    for (const r of group) if (r.id !== winner!.id) loserIds.add(r.id)
  }
  if (loserIds.size === 0) return rules

  const now = new Date().toISOString()
  return rules.map((r) => (loserIds.has(r.id) ? { ...r, supersededAt: now } : r))
}

export const useScheduleRuleStore = create<ScheduleRuleStore>()(
  persist(
    (set, get) => ({
      scheduleRules: [],
      orphanRepairedAt: null,
      markOrphanRepaired: (at) => set({ orphanRepairedAt: at }),

      addRule: (data) => {
        const rule = newEntity(data)
        set((state) => ({ scheduleRules: [...state.scheduleRules, rule] }))
        return rule
      },

      supersedeRule: (id) => {
        set((state) => ({
          scheduleRules: updateById(state.scheduleRules, id, { supersededAt: new Date().toISOString() }),
        }))
      },

      supersedeRules: (ids) => {
        if (ids.length === 0) return
        const idSet = new Set(ids)
        const supersededAt = new Date().toISOString()
        set((state) => ({
          scheduleRules: state.scheduleRules.map((r) => (idSet.has(r.id) ? { ...r, supersededAt } : r)),
        }))
      },

      reviveRule: (id) => {
        set((state) => ({
          scheduleRules: updateById(state.scheduleRules, id, { supersededAt: null }),
        }))
      },

      getRule: (id) => {
        return findById(get().scheduleRules, id)
      },

      getRulesByVehicle: (vehicleId) => {
        return get().scheduleRules.filter((r) => r.vehicleId === vehicleId && r.supersededAt === null)
      },

      getActiveRule: (vehicleId, itemTypeId) => {
        return newestRule(get().getActiveRules(vehicleId, itemTypeId))
      },

      getActiveRules: (vehicleId, itemTypeId) => {
        return get().scheduleRules.filter(
          (r) => r.vehicleId === vehicleId && r.itemTypeId === itemTypeId && r.supersededAt === null
        )
      },
    }),
    {
      name: 'schedule-rule-store',
      storage: createJSONStorage(getStorageAdapter),
      version: 1,
      // v0 -> v1: sync's per-row-id merge has no notion of the "one live rule
      // per vehicle+item type" invariant (see the interface doc comment
      // above), so two devices independently editing the same rule while
      // offline from each other converge on two live rules instead of one.
      // One-time repair for whatever's already accumulated that way; new
      // writes self-heal it going forward (scheduleOps.ts's setScheduleRule).
      migrate: (persisted: any) => {
        persisted.scheduleRules = collapseDuplicateLiveRules(persisted.scheduleRules ?? [])
        return persisted
      },
    }
  )
)
