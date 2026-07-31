// Reduces a vehicle's live ScheduleRules into a single badge-friendly status.
// No store access — callers pass in rules already filtered to this vehicle
// (e.g. useScheduleRuleStore.getState().getRulesByVehicle(vehicleId), which
// only returns live/non-superseded rows).
import type { ScheduleRule } from '../store/scheduleRuleStore'
import { groupDueLines, dueLineTone, dueDateTone, DueTone, DueLine } from './scheduleEngine'
import { translate } from './i18n'

export type VehicleDueStatus =
  | { kind: 'no_schedule' }
  | { kind: 'scheduled'; tone: DueTone; lines: DueLine[] }

const TONE_RANK: Record<DueTone, number> = { overdue: 3, due_soon: 2, on_track: 1 }

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
  const tone = lines.reduce<DueTone>((worst, line) => {
    const axisTones = [
      line.dueKm != null ? dueLineTone(line.dueKm, currentOdometer) : null,
      line.dueDate != null ? dueDateTone(line.dueDate, currentDate) : null,
    ].filter((t): t is DueTone => t !== null)
    const lineTone = axisTones.reduce<DueTone>((w, t) => (TONE_RANK[t] > TONE_RANK[w] ? t : w), 'on_track')
    return TONE_RANK[lineTone] > TONE_RANK[worst] ? lineTone : worst
  }, 'on_track')
  return { kind: 'scheduled', tone, lines }
}

export function dueStatusLabel(status: VehicleDueStatus): string {
  if (status.kind === 'no_schedule') return translate('vehicles.dueNoSchedule')
  if (status.tone === 'overdue') return translate('vehicles.dueOverdue')
  if (status.tone === 'due_soon') return translate('vehicles.dueSoon')
  return translate('vehicles.dueOnTrack')
}

export function dueStatusBadgeTone(status: VehicleDueStatus): 'neutral' | 'warning' | 'danger' | 'info' {
  if (status.kind === 'no_schedule') return 'info'
  if (status.tone === 'overdue') return 'danger'
  if (status.tone === 'due_soon') return 'warning'
  return 'neutral'
}
