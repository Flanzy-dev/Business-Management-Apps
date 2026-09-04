// Shared "time remaining until a bay/order finishes" presentation — was two
// independent implementations (Bays.tsx and Dashboard's technician queue in
// src/lib/dashboardMetrics.ts's buildTechnicianQueue), each re-deriving the
// same branch (overdue / under an hour / an hour or more) by hand. Pure and
// numbers-only, same convention as dashboardMetrics.ts itself, so each
// caller still picks its own translation key and wording — Dashboard's
// compact "{{m}}m" chip and Bays' "{{m}}m left" card read differently on
// purpose, and this only shares the arithmetic, not the copy.

export type MinutesRemainingDisplay =
  | { kind: 'overdue' }
  | { kind: 'minutes'; minutes: number }
  | { kind: 'hoursMinutes'; hours: number; minutes: number }

/**
 * `minutesRemaining <= 0` is overdue — matches
 * dashboardMetrics.ts's buildTechnicianQueue, which stamps exactly `-1` for
 * that case, and Bays.tsx's own diff-based calculation, which can land on
 * 0 or a small negative number instead. Either convention lands here safely.
 */
export function describeMinutesRemaining(minutesRemaining: number): MinutesRemainingDisplay {
  if (minutesRemaining <= 0) return { kind: 'overdue' }
  if (minutesRemaining < 60) return { kind: 'minutes', minutes: minutesRemaining }
  return { kind: 'hoursMinutes', hours: Math.floor(minutesRemaining / 60), minutes: minutesRemaining % 60 }
}

/** Whole minutes from `now` until `end`, rounded up — matches the
 *  "any part of a minute still counts" feel of a countdown. */
export function minutesUntil(end: Date, now: Date): number {
  return Math.ceil((end.getTime() - now.getTime()) / 60_000)
}
