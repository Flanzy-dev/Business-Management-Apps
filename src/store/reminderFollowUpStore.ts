import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { updateById } from './entityHelpers'
import { getStorageAdapter } from '../lib/storageAdapter'

/**
 * Live per-vehicle state for the Reminders page: "I called them" and/or
 * "hide this until a date" — not an audit trail, so there's exactly one row
 * per vehicle, upserted in place, and its `id` is just the vehicle's id
 * rather than a generated uuid (see src/lib/ops/scheduleOps.ts's
 * ScheduleRule for the append-only alternative this deliberately isn't:
 * nothing here needs a history of past contacts, only the current state).
 */
export interface ReminderFollowUp {
  id: string // == vehicleId
  vehicleId: string
  /** ISO instant of the last "Mark contacted" click, or null. */
  contactedAt: string | null
  /** 'YYYY-MM-DD' — the reminder is hidden from getVehicleReminders while
   *  this is still in the future (src/lib/reminders.ts). Null = not snoozed. */
  snoozeUntil: string | null
  createdAt: string
}

interface ReminderFollowUpStore {
  followUps: ReminderFollowUp[]
  markContacted: (vehicleId: string, at: string) => void
  snooze: (vehicleId: string, untilDate: string) => void
  clearSnooze: (vehicleId: string) => void
  /** Wipes both fields — called when the vehicle is actually serviced (see
   *  src/lib/ops/orderOps.ts's completeOrder), since a prior "contacted about
   *  being overdue" note no longer applies once the schedule has moved on. */
  clear: (vehicleId: string) => void
  getForVehicle: (vehicleId: string) => ReminderFollowUp | undefined
}

export const useReminderFollowUpStore = create<ReminderFollowUpStore>()(
  persist(
    (set, get) => ({
      followUps: [],

      // Every mutation upserts through this one path so "create if missing,
      // else merge" can't drift between markContacted/snooze/clearSnooze/clear.
      markContacted: (vehicleId, at) => set((state) => ({ followUps: upsert(state.followUps, vehicleId, { contactedAt: at }) })),
      snooze: (vehicleId, untilDate) => set((state) => ({ followUps: upsert(state.followUps, vehicleId, { snoozeUntil: untilDate }) })),
      clearSnooze: (vehicleId) => set((state) => ({ followUps: upsert(state.followUps, vehicleId, { snoozeUntil: null }) })),
      clear: (vehicleId) => set((state) => ({ followUps: upsert(state.followUps, vehicleId, { contactedAt: null, snoozeUntil: null }) })),

      getForVehicle: (vehicleId) => get().followUps.find((f) => f.id === vehicleId),
    }),
    { name: 'reminder-follow-up-store', storage: createJSONStorage(getStorageAdapter) }
  )
)

function upsert(followUps: ReminderFollowUp[], vehicleId: string, data: Partial<ReminderFollowUp>): ReminderFollowUp[] {
  const existing = followUps.find((f) => f.id === vehicleId)
  if (existing) return updateById(followUps, vehicleId, data)
  return [
    ...followUps,
    { id: vehicleId, vehicleId, contactedAt: null, snoozeUntil: null, createdAt: new Date().toISOString(), ...data },
  ]
}
