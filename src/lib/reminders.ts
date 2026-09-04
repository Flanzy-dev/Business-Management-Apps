// Shop-wide view over the per-vehicle due status vehicleDueSummary.ts already
// computes — no store access, same pattern as scheduleEngine.ts: callers read
// vehicles/rules from their stores and pass arrays in.
import type { Vehicle } from '../store/vehicleStore'
import type { ScheduleRule } from '../store/scheduleRuleStore'
import type { ReminderFollowUp } from '../store/reminderFollowUpStore'
import { getVehicleDueStatus, VehicleDueStatus } from './vehicleDueSummary'
import { activeRulesForVehicle, formatDueLine, type DueLine } from './scheduleEngine'
import { dayKeyLocal } from './dateKeys'

const TONE_RANK: Record<'overdue' | 'due_soon', number> = { overdue: 2, due_soon: 1 }

export interface VehicleReminder {
  vehicle: Vehicle
  status: Extract<VehicleDueStatus, { kind: 'scheduled' }>
  /** This vehicle's contacted/snooze state, if any (src/store/reminderFollowUpStore.ts). */
  followUp?: ReminderFollowUp
}

function sortByTone(reminders: VehicleReminder[]): VehicleReminder[] {
  return reminders.sort((a, b) => TONE_RANK[b.status.tone as 'overdue' | 'due_soon'] - TONE_RANK[a.status.tone as 'overdue' | 'due_soon'])
}

function isSnoozed(followUp: ReminderFollowUp | undefined, currentDate: Date): boolean {
  return !!followUp?.snoozeUntil && followUp.snoozeUntil > dayKeyLocal(currentDate)
}

/** "5.000 km lagi — Oli Mesin; 12 Sep — Minyak Rem": every due line for one
 *  vehicle joined into the one-line summary both the Reminders page and its
 *  dashboard rail render. */
export function formatDueDescription(lines: DueLine[], itemTypeName: (id: string) => string): string {
  return lines
    .map((line) => {
      const { when, what } = formatDueLine(line, itemTypeName)
      return `${when} — ${what}`
    })
    .join('; ')
}

/** Split a reminder list by tone — the same overdue/due-soon grouping the
 *  Reminders page and its dashboard rail both render as separate sections. */
export function partitionByTone(reminders: VehicleReminder[]): { overdue: VehicleReminder[]; dueSoon: VehicleReminder[] } {
  return {
    overdue: reminders.filter((r) => r.status.tone === 'overdue'),
    dueSoon: reminders.filter((r) => r.status.tone === 'due_soon'),
  }
}

/** Every vehicle currently overdue or due-soon, snoozed or not — the shared
 *  base both getVehicleReminders and getSnoozedVehicleReminders filter. */
function dueVehicleReminders(
  vehicles: Vehicle[],
  scheduleRules: ScheduleRule[],
  currentDate: Date,
  followUps: ReminderFollowUp[]
): VehicleReminder[] {
  const followUpByVehicle = new Map(followUps.map((f) => [f.vehicleId, f]))
  const reminders: VehicleReminder[] = []
  for (const vehicle of vehicles) {
    const liveRules = activeRulesForVehicle(scheduleRules, vehicle.id)
    const status = getVehicleDueStatus(liveRules, vehicle.currentMileage ?? 0, currentDate)
    if (status.kind === 'scheduled' && status.tone !== 'on_track') {
      reminders.push({ vehicle, status, followUp: followUpByVehicle.get(vehicle.id) })
    }
  }
  return reminders
}

/**
 * Every vehicle currently overdue or due-soon, worst first. A vehicle that's
 * on-track or has no schedule at all isn't a reminder — it drops off this
 * list the moment its next work order completes and the schedule advances.
 * A vehicle whose follow-up record (`followUps`) carries a `snoozeUntil`
 * still in the future is excluded here too — see getSnoozedVehicleReminders
 * for that set instead of a dead end.
 */
export function getVehicleReminders(
  vehicles: Vehicle[],
  scheduleRules: ScheduleRule[],
  currentDate: Date = new Date(),
  followUps: ReminderFollowUp[] = []
): VehicleReminder[] {
  return sortByTone(
    dueVehicleReminders(vehicles, scheduleRules, currentDate, followUps).filter((r) => !isSnoozed(r.followUp, currentDate))
  )
}

/**
 * The opposite of getVehicleReminders' snooze filter: still overdue or
 * due-soon, but currently hidden behind an unexpired snooze — so a snooze set
 * by mistake (or one worth revisiting early) isn't invisible until it expires
 * on its own.
 */
export function getSnoozedVehicleReminders(
  vehicles: Vehicle[],
  scheduleRules: ScheduleRule[],
  currentDate: Date = new Date(),
  followUps: ReminderFollowUp[] = []
): VehicleReminder[] {
  return sortByTone(
    dueVehicleReminders(vehicles, scheduleRules, currentDate, followUps).filter((r) => isSnoozed(r.followUp, currentDate))
  )
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
