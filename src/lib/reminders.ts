// Shop-wide view over the per-vehicle due status vehicleDueSummary.ts already
// computes — no store access, same pattern as scheduleEngine.ts: callers read
// vehicles/rules from their stores and pass arrays in.
import type { Vehicle } from '../store/vehicleStore'
import type { ScheduleRule } from '../store/scheduleRuleStore'
import { getVehicleDueStatus, VehicleDueStatus } from './vehicleDueSummary'

const TONE_RANK: Record<'overdue' | 'due_soon', number> = { overdue: 2, due_soon: 1 }

export interface VehicleReminder {
  vehicle: Vehicle
  status: Extract<VehicleDueStatus, { kind: 'scheduled' }>
}

/**
 * Every vehicle currently overdue or due-soon, worst first. A vehicle that's
 * on-track or has no schedule at all isn't a reminder — it drops off this
 * list the moment its next work order completes and the schedule advances.
 */
export function getVehicleReminders(
  vehicles: Vehicle[],
  scheduleRules: ScheduleRule[],
  currentDate: Date = new Date()
): VehicleReminder[] {
  const reminders: VehicleReminder[] = []
  for (const vehicle of vehicles) {
    const liveRules = scheduleRules.filter((r) => r.vehicleId === vehicle.id && r.supersededAt === null)
    const status = getVehicleDueStatus(liveRules, vehicle.currentMileage ?? 0, currentDate)
    if (status.kind === 'scheduled' && status.tone !== 'on_track') {
      reminders.push({ vehicle, status })
    }
  }
  return reminders.sort((a, b) => TONE_RANK[b.status.tone as 'overdue' | 'due_soon'] - TONE_RANK[a.status.tone as 'overdue' | 'due_soon'])
}

/** Digits wa.me expects: strips everything but digits, converts a leading 0 to Indonesia's 62. */
export function normalizeWhatsAppPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return digits.startsWith('0') ? `62${digits.slice(1)}` : digits
}

/** The drafted reminder text, translated via the caller's own t() (same pattern as every other lib/ compositional string). */
export function buildReminderMessage(
  t: (key: string, vars?: Record<string, string | number>) => string,
  ownerName: string,
  vehicleLabel: string,
  dueDescription: string
): string {
  return t('reminders.messageTemplate', { owner: ownerName, vehicle: vehicleLabel, due: dueDescription })
}
