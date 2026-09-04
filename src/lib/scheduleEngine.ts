// Pure scheduling math over ScheduleRule rows. No store access — callers in
// src/lib/ops/ and pages read live rules from scheduleRuleStore and pass them
// in here. Nothing here ever computes a due-km and persists it: due-km is
// always derived on demand from a rule's base/interval plus the current
// odometer, so a superseded rule can never leave a stale mark behind.
import { newestRule, type ScheduleRule } from '../store/scheduleRuleStore'
import { formatDistance } from './units'
import { formatDate } from './dates'

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

/**
 * A vehicle's live (non-superseded) schedule rules, at most one per item
 * type — the same `r.vehicleId === vehicleId && r.supersededAt === null`
 * filter that used to be hand-written at each call site (Vehicles.tsx,
 * WorkOrderEditor.tsx), now also collapsing to one rule per itemTypeId via
 * newestRule (scheduleRuleStore.ts). Sync's per-row merge can leave more
 * than one rule live for the same vehicle+item pair (see that store's
 * interface doc comment) — every reader collapsing to the same deterministic
 * winner is what keeps a duplicate from ever showing as two rows, even
 * before a write comes along to actually supersede the loser.
 */
export function activeRulesForVehicle(rules: ScheduleRule[], vehicleId: string): ScheduleRule[] {
  const live = rules.filter((r) => r.vehicleId === vehicleId && r.supersededAt === null)
  const byItemType = new Map<string, ScheduleRule[]>()
  for (const r of live) {
    const group = byItemType.get(r.itemTypeId)
    if (group) group.push(r)
    else byItemType.set(r.itemTypeId, [r])
  }
  return [...byItemType.values()].map((group) => newestRule(group)!)
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

export interface DueLineText {
  /** "12,000 km / Jan 5, 2026" — the km/date half, joined with " / ". */
  when: string
  /** "Engine Oil, Oil Filter" — the item-type names half, joined with ", ". */
  what: string
}

/**
 * Render one DueLine as its two natural parts. Kept as two strings rather
 * than one pre-joined line: Vehicles.tsx renders `when` in its own styled
 * `<span>`, while Reminders.tsx and receiptDueLines.ts join them with an em
 * dash into one plain string — both used to rebuild this formatting by hand.
 */
export function formatDueLine(line: DueLine, itemTypeName: (id: string) => string): DueLineText {
  const when = [
    line.dueKm != null ? formatDistance(line.dueKm) : null,
    line.dueDate != null ? formatDate(line.dueDate) : null,
  ].filter(Boolean).join(' / ')
  const what = line.itemTypeIds.map(itemTypeName).join(', ')
  return { when, what }
}

export type DueTone = 'overdue' | 'due_soon' | 'on_track'

export function dueLineTone(dueKm: number, currentOdometer: number, dueSoonWindowKm = 500): DueTone {
  const remaining = dueKm - currentOdometer
  if (remaining <= 0) return 'overdue'
  if (remaining <= dueSoonWindowKm) return 'due_soon'
  return 'on_track'
}

/**
 * Date-axis counterpart to dueLineTone — same "remaining <= 0 = due now" shape,
 * in days. `currentDate` is floored to local midnight before comparing, same
 * as `due` itself — otherwise the answer depends on the time of day this is
 * called: a car due tomorrow read as "overdue" from a caller passing
 * end-of-today and "due soon" from one passing the current instant. Flooring
 * both sides makes every caller (vehicleDueSummary.ts, reminders.ts,
 * globalSearch.ts, receivables.ts's own dueDateTone reuse for payment due
 * dates) agree regardless of what moment "now" is measured at.
 */
export function dueDateTone(dueDate: string, currentDate: Date, dueSoonWindowDays = 14): DueTone {
  const [year, month, day] = dueDate.slice(0, 10).split('-').map(Number)
  const due = new Date(year, month - 1, day)
  const today = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate())
  const remainingDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (remainingDays <= 0) return 'overdue'
  if (remainingDays <= dueSoonWindowDays) return 'due_soon'
  return 'on_track'
}
