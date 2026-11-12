// Shop-wide view over the per-vehicle due status vehicleDueSummary.ts already
// computes — no store access, same pattern as scheduleEngine.ts: callers read
// vehicles/rules from their stores and pass arrays in.
import type { Vehicle } from '../../store/vehicleStore'
import type { ScheduleRule } from '../../store/scheduleRuleStore'
import type { ReminderFollowUp } from '../../store/reminderFollowUpStore'
import { getVehicleDueStatus, VehicleDueStatus } from '../vehicles/vehicleDueSummary'
import { activeRulesByVehicle, attentionLines, formatDueLine, nextDueDate, type DueLine } from './scheduleEngine'
import { projectOdometer, type OdometerReading } from './odometerProjection'
import { dayKeyLocal } from '../format/dateKeys'

const TONE_RANK: Record<'overdue' | 'due_soon', number> = { overdue: 2, due_soon: 1 }

/** Where a reminder's due marks come from: the vehicle's own schedule rules, or
 *  — for a car that has none — the shop's default interval from its last visit. */
export type ReminderBasis = 'schedule' | 'default'

/**
 * A car with no schedule rule is still reminded about, for this long after its
 * last visit. Without a window, every customer who ever came once and left would
 * be "overdue" forever — the history import alone holds hundreds of cars not
 * seen in over a year, and a list that long stops being read.
 */
export const DEFAULT_REMINDER_WINDOW_MONTHS = 12

export interface ReminderOptions {
  /** Each vehicle's odometer readings from completed visits
   *  (odometerProjection.readingsByVehicle). With them, a car that has not come
   *  back is carried forward at its usual rate, instead of reading as frozen at
   *  its last visit's figure. */
  readings?: Map<string, OdometerReading[]>
  /** The shop's default service interval, used for a car with no schedule rule. */
  fallback?: { intervalKm: number; intervalMonths: number }
}

export interface VehicleReminder {
  vehicle: Vehicle
  status: Extract<VehicleDueStatus, { kind: 'scheduled' }>
  /** Own schedule, or the shop's default interval (see ReminderBasis). */
  basis: ReminderBasis
  /** The odometer the due marks were judged against. */
  odometer: number
  /** True when `odometer` is an estimate carried forward from the last visit. */
  odometerEstimated: boolean
  /** The lines of `status` that are overdue or due soon — what the customer is
   *  being reminded about. `status.lines` also holds the marks still far off. */
  dueLines: DueLine[]
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

/**
 * The rule a car with none of its own is judged by: the shop's default interval,
 * counted from its last visit. Null when it has not visited, or last visited
 * longer ago than DEFAULT_REMINDER_WINDOW_MONTHS (a lapsed customer, not a late one).
 */
function defaultRuleFor(
  vehicle: Vehicle,
  visits: OdometerReading[],
  fallback: NonNullable<ReminderOptions['fallback']>,
  currentDate: Date
): ScheduleRule | null {
  const last = visits[visits.length - 1]
  if (!last) return null
  if (dayKeyLocal(currentDate) > nextDueDate(last.date, DEFAULT_REMINDER_WINDOW_MONTHS)) return null
  return {
    id: `default:${vehicle.id}`,
    vehicleId: vehicle.id,
    itemTypeId: '',
    intervalKm: fallback.intervalKm,
    baseOdometer: last.km,
    intervalMonths: fallback.intervalMonths,
    baseDate: last.date,
    source: 'workshop_default',
    supersededAt: null,
    supersedesId: null,
    notes: '',
    createdAt: last.date,
  }
}

/** A default-interval line names no item — the shop doesn't know what was done last time. */
const withoutItemTypes = (lines: DueLine[]): DueLine[] => lines.map((line) => ({ ...line, itemTypeIds: [] }))

/** Every vehicle currently overdue or due-soon, snoozed or not — the shared
 *  base both getVehicleReminders and getSnoozedVehicleReminders filter. */
function dueVehicleReminders(
  vehicles: Vehicle[],
  scheduleRules: ScheduleRule[],
  currentDate: Date,
  followUps: ReminderFollowUp[],
  options: ReminderOptions
): VehicleReminder[] {
  const followUpByVehicle = new Map(followUps.map((f) => [f.vehicleId, f]))
  const rulesByVehicle = activeRulesByVehicle(scheduleRules)
  const reminders: VehicleReminder[] = []
  for (const vehicle of vehicles) {
    const visits = options.readings?.get(vehicle.id) ?? []
    // Where the car probably is NOW, not where it was when it last came in.
    const projection = projectOdometer(vehicle.currentMileage, visits, currentDate)
    const odometer = projection.km

    let rules = rulesByVehicle.get(vehicle.id) ?? []
    let basis: ReminderBasis = 'schedule'
    if (rules.length === 0) {
      const fallback = options.fallback ? defaultRuleFor(vehicle, visits, options.fallback, currentDate) : null
      if (!fallback) continue
      rules = [fallback]
      basis = 'default'
    }

    const status = getVehicleDueStatus(rules, odometer, currentDate)
    if (status.kind !== 'scheduled' || status.tone === 'on_track') continue
    const named = basis === 'default' ? withoutItemTypes : (lines: DueLine[]) => lines
    reminders.push({
      vehicle,
      status: { ...status, lines: named(status.lines) },
      basis,
      odometer,
      odometerEstimated: projection.estimated,
      dueLines: named(attentionLines(status.lines, odometer, currentDate)),
      followUp: followUpByVehicle.get(vehicle.id),
    })
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
  followUps: ReminderFollowUp[] = [],
  options: ReminderOptions = {}
): VehicleReminder[] {
  return sortByTone(
    dueVehicleReminders(vehicles, scheduleRules, currentDate, followUps, options).filter((r) => !isSnoozed(r.followUp, currentDate))
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
  followUps: ReminderFollowUp[] = [],
  options: ReminderOptions = {}
): VehicleReminder[] {
  return sortByTone(
    dueVehicleReminders(vehicles, scheduleRules, currentDate, followUps, options).filter((r) => isSnoozed(r.followUp, currentDate))
  )
}

export interface ReminderGroups {
  overdue: VehicleReminder[]
  dueSoon: VehicleReminder[]
  /** Overdue or due-soon, but hidden behind an unexpired snooze. */
  snoozed: VehicleReminder[]
}

/**
 * Everything the Reminders page lists, from ONE scan of the vehicles. The page
 * used to call getVehicleReminders and getSnoozedVehicleReminders separately,
 * each running the full vehicles × rules pass, on every render.
 */
export function getReminderGroups(
  vehicles: Vehicle[],
  scheduleRules: ScheduleRule[],
  currentDate: Date = new Date(),
  followUps: ReminderFollowUp[] = [],
  options: ReminderOptions = {}
): ReminderGroups {
  const due = dueVehicleReminders(vehicles, scheduleRules, currentDate, followUps, options)
  const live = due.filter((r) => !isSnoozed(r.followUp, currentDate))
  return {
    ...partitionByTone(sortByTone(live)),
    snoozed: sortByTone(due.filter((r) => isSnoozed(r.followUp, currentDate))),
  }
}

/** Digits wa.me expects: strips everything but digits, converts a leading 0 to Indonesia's 62. */
export function normalizeWhatsAppPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return digits.startsWith('0') ? `62${digits.slice(1)}` : digits
}

/** The wa.me link that opens a chat with `message` ready to send. */
export function whatsAppUrl(phone: string, message: string): string {
  return `https://wa.me/${normalizeWhatsAppPhone(phone)}?text=${encodeURIComponent(message)}`
}

/** `message` signed with the shop's name, so the customer knows who it is from —
 *  a bare number messaging "your car is due" reads like spam. Unsigned when the
 *  shop never set a name. */
export function signWithShop(message: string, shopName: string | null | undefined, signature: (shop: string) => string): string {
  const shop = shopName?.trim()
  return shop ? `${message}\n${signature(shop)}` : message
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
