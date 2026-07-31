// Pure scheduling math over ScheduleRule rows. No store access — callers in
// src/lib/ops/ and pages read live rules from scheduleRuleStore and pass them
// in here. Nothing here ever computes a due-km and persists it: due-km is
// always derived on demand from a rule's base/interval plus the current
// odometer, so a superseded rule can never leave a stale mark behind.
import type { ScheduleRule } from '../store/scheduleRuleStore'

/**
 * due_km = base + interval, exactly one step past the last real service. This
 * is a fixed target, not a ladder that re-aims at whatever's next once the
 * odometer has already passed it — it only ever moves when `baseOdometer`
 * itself changes (i.e. the vehicle is actually serviced and the rule is
 * superseded with a new base). A vehicle that never comes back stays overdue
 * by a growing amount instead of silently reading as on-track again once it
 * drives past the mark.
 */
export function nextDueKm(baseOdometer: number, intervalKm: number): number {
  return baseOdometer + intervalKm
}

/**
 * due_date = base + intervalMonths, the calendar-month counterpart to
 * nextDueKm — same fixed-target reasoning, in month-space. baseDate is parsed
 * as LOCAL midnight ('YYYY-MM-DD' would parse as UTC and risk a day-shift —
 * same reasoning as finance.ts's expenseDate).
 */
export function nextDueDate(baseDate: string, intervalMonths: number): string {
  const [year, month, day] = baseDate.slice(0, 10).split('-').map(Number)
  const due = new Date(year, month - 1, day)
  due.setMonth(due.getMonth() + intervalMonths)
  const dd = String(due.getDate()).padStart(2, '0')
  const mm = String(due.getMonth() + 1).padStart(2, '0')
  return `${due.getFullYear()}-${mm}-${dd}`
}

/**
 * True iff km is a valid mark on this schedule: km = base + interval*n for
 * some non-negative integer n. Used to validate schedule-rule setup entries
 * and catch data-entry errors (e.g. a part number typed into a km field).
 */
export function isValidScheduleMark(baseOdometer: number, intervalKm: number, km: number): boolean {
  if (intervalKm <= 0) return false
  const diff = km - baseOdometer
  return diff >= 0 && diff % intervalKm === 0
}

export interface DueLine {
  dueKm: number | null
  dueDate: string | null
  itemTypeIds: string[]
}

/**
 * Live (non-superseded) rules, grouped by coincident (next-due km, next-due
 * date) pair — two rules sharing the same base and interval collapse into
 * one line instead of showing as redundant duplicates. A rule that doesn't
 * track an axis (intervalKm or intervalMonths null) contributes null for it —
 * whichever axis a vehicleDueSummary caller reads decides the tone.
 */
export function groupDueLines(rules: ScheduleRule[]): DueLine[] {
  const live = rules.filter((r) => r.supersededAt === null)
  const byKey = new Map<string, DueLine>()
  for (const r of live) {
    const dueKm = r.intervalKm != null && r.baseOdometer != null ? nextDueKm(r.baseOdometer, r.intervalKm) : null
    const dueDate = r.intervalMonths != null && r.baseDate ? nextDueDate(r.baseDate, r.intervalMonths) : null
    const key = `${dueKm ?? ''}|${dueDate ?? ''}`
    const entry = byKey.get(key) ?? { dueKm, dueDate, itemTypeIds: [] }
    entry.itemTypeIds.push(r.itemTypeId)
    byKey.set(key, entry)
  }
  return [...byKey.values()].sort((a, b) => {
    const kmA = a.dueKm ?? Infinity
    const kmB = b.dueKm ?? Infinity
    if (kmA !== kmB) return kmA - kmB
    return (a.dueDate ?? '9999-99-99').localeCompare(b.dueDate ?? '9999-99-99')
  })
}

export type DueTone = 'overdue' | 'due_soon' | 'on_track'

export function dueLineTone(dueKm: number, currentOdometer: number, dueSoonWindowKm = 500): DueTone {
  const remaining = dueKm - currentOdometer
  if (remaining <= 0) return 'overdue'
  if (remaining <= dueSoonWindowKm) return 'due_soon'
  return 'on_track'
}

/** Date-axis counterpart to dueLineTone — same "remaining <= 0 = due now" shape, in days. */
export function dueDateTone(dueDate: string, currentDate: Date, dueSoonWindowDays = 14): DueTone {
  const [year, month, day] = dueDate.slice(0, 10).split('-').map(Number)
  const due = new Date(year, month - 1, day)
  const remainingDays = Math.round((due.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24))
  if (remainingDays <= 0) return 'overdue'
  if (remainingDays <= dueSoonWindowDays) return 'due_soon'
  return 'on_track'
}
