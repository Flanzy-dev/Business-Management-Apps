// Local-timezone bucketing keys — split out of src/lib/dates.ts because this
// is the one group of date helpers in this app with a real correctness
// invariant: every report's day/month grouping has to bucket by *local*
// midnight, not UTC, or a sale made at 00:30 near a timezone boundary lands
// in the wrong day/month. src/lib/finance.ts and src/lib/heatmap.ts depend
// on that invariant holding; src/lib/__tests__/dateKeys.test.ts guards it.
//
// (Display formatting and period-range arithmetic — formatDate,
// getPeriodRange, etc. — have no such invariant and stay in dates.ts.)

/** 'YYYY-MM' month key in local time. */
export function monthKeyLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** 'YYYY-MM-DD' day key in local time. */
export function dayKeyLocal(d: Date): string {
  return `${monthKeyLocal(d)}-${String(d.getDate()).padStart(2, '0')}`
}

/** "Aug 25" — short label for a 'YYYY-MM' month key. */
export function monthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

/** 'YYYY-MM-DD' day key `days` days out from `now` (default today), local
 *  time — Reminders.tsx's snooze picker ("1 week"/"2 weeks"/"1 month" out),
 *  same shape as receivables.ts's defaultPaymentDueDate. */
export function daysFromNowKey(days: number, now: Date = new Date()): string {
  const d = new Date(now)
  d.setDate(d.getDate() + days)
  return dayKeyLocal(d)
}

/** The last n month keys, oldest → newest, ending with the current month. */
export function lastNMonthKeys(n: number, now: Date = new Date()): string[] {
  const keys: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    keys.push(monthKeyLocal(new Date(now.getFullYear(), now.getMonth() - i, 1)))
  }
  return keys
}
