import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { newEntity, updateById } from './entityHelpers'
import { getStorageAdapter } from '../lib/storageAdapter'

export interface ScheduleRule {
  id: string
  vehicleId: string
  itemTypeId: string
  // null means this rule doesn't track that axis. A rule must track at
  // least one of km/months (enforced by ManageScheduleDialog, not here —
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
  notes: string
  createdAt: string
}

// Rules are never edited in place — see src/lib/ops/scheduleOps.ts, the only
// place that should call addRule/supersede together, so "archive old, insert
// replacement" can never be split into two separate mutations.
interface ScheduleRuleStore {
  scheduleRules: ScheduleRule[]
  addRule: (data: Omit<ScheduleRule, 'id' | 'createdAt'>) => ScheduleRule
  supersedeRule: (id: string) => void
  getRule: (id: string) => ScheduleRule | undefined
  getRulesByVehicle: (vehicleId: string) => ScheduleRule[]
  getActiveRule: (vehicleId: string, itemTypeId: string) => ScheduleRule | undefined
}

export const useScheduleRuleStore = create<ScheduleRuleStore>()(
  persist(
    (set, get) => ({
      scheduleRules: [],

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

      getRule: (id) => {
        return get().scheduleRules.find((r) => r.id === id)
      },

      getRulesByVehicle: (vehicleId) => {
        return get().scheduleRules.filter((r) => r.vehicleId === vehicleId && r.supersededAt === null)
      },

      getActiveRule: (vehicleId, itemTypeId) => {
        return get().scheduleRules.find(
          (r) => r.vehicleId === vehicleId && r.itemTypeId === itemTypeId && r.supersededAt === null
        )
      },
    }),
    { name: 'schedule-rule-store', storage: createJSONStorage(getStorageAdapter) }
  )
)
