// Reduces a vehicle's live ScheduleRules into a single badge-friendly status.
// No store access — callers pass in rules already filtered to this vehicle
// (e.g. useScheduleRuleStore.getState().getRulesByVehicle(vehicleId), which
// only returns live/non-superseded rows).
import type { ScheduleRule } from '../../store/scheduleRuleStore'
import { groupDueLines, dueLineToneOf, worstTone, DueTone, DueLine } from '../schedule/scheduleEngine'
import { translate } from '../i18n'

export type VehicleDueStatus =
  | { kind: 'no_schedule' }
  | { kind: 'scheduled'; tone: DueTone; lines: DueLine[] }

/**
 * Worst of the two axes on a line, then worst line wins overall — a rule
 * that's on-track by km but overdue by date (or vice versa) still reads
 * overdue, matching the "whichever comes first" contract.
 */
export function getVehicleDueStatus(
  liveRules: ScheduleRule[],
  currentOdometer: number,
  currentDate: Date = new Date()
): VehicleDueStatus {
  if (liveRules.length === 0) return { kind: 'no_schedule' }
  const lines = groupDueLines(liveRules)
  const tone = lines.reduce<DueTone>((worst, line) => worstTone(worst, dueLineToneOf(line, currentOdometer, currentDate)), 'on_track')
  return { kind: 'scheduled', tone, lines }
}

export function dueToneLabel(tone: DueTone): string {
  if (tone === 'overdue') return translate('vehicles.dueOverdue')
  if (tone === 'due_soon') return translate('vehicles.dueSoon')
  return translate('vehicles.dueOnTrack')
}

export function dueToneBadgeTone(tone: DueTone): 'neutral' | 'warning' | 'danger' {
  if (tone === 'overdue') return 'danger'
  if (tone === 'due_soon') return 'warning'
  return 'neutral'
}

export function dueStatusLabel(status: VehicleDueStatus): string {
  if (status.kind === 'no_schedule') return translate('vehicles.dueNoSchedule')
  return dueToneLabel(status.tone)
}

export function dueStatusBadgeTone(status: VehicleDueStatus): 'neutral' | 'warning' | 'danger' | 'info' {
  if (status.kind === 'no_schedule') return 'info'
  return dueToneBadgeTone(status.tone)
}
