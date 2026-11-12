// Local-timezone bucketing keys — split out of src/lib/format/dates.ts because this
// is the one group of date helpers in this app with a real correctness
// invariant: every report's day/month grouping has to bucket by *local*
// midnight, not UTC, or a sale made at 00:30 near a timezone boundary lands
// in the wrong day/month. src/lib/reports/finance.ts and src/lib/reports/heatmap.ts depend
// on that invariant holding; src/lib/__tests__/dateKeys.test.ts guards it.
//
// (Display formatting and period-range arithmetic — formatDate,
// getPeriodRange, etc. — have no such invariant and stay in dates.ts.)
import { activeDateLocale, type DateLocale } from './locale'

/** 'YYYY-MM' month key in local time. */
export function monthKeyLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** 'YYYY-MM-DD' day key in local time. */
export function dayKeyLocal(d: Date): string {
  return `${monthKeyLocal(d)}-${String(d.getDate()).padStart(2, '0')}`
}

/** The local 'YYYY-MM-DD' of a stored timestamp. A bare date is already one
 *  and passes through; an ISO instant ('…Z', UTC) goes through local time —
 *  slicing its first ten characters reads the UTC date, which in Jakarta
 *  (UTC+7) is yesterday for anything done between 00:00 and 07:00. */
export function localDayOf(stamp: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(stamp) ? stamp : dayKeyLocal(new Date(stamp))
}

/** "Aug 25" — short label for a 'YYYY-MM' month key, in the active language. */
export function monthLabel(key: string, locale: DateLocale = activeDateLocale()): string {
  const [year, month] = key.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString(locale, { month: 'short', year: '2-digit' })
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
