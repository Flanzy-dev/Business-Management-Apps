// Shared date/time formatters and period-range arithmetic — one place for
// the app's date presentation, replacing the several ad-hoc `formatDate`
// helpers previously copied across pages.
//
// Local-timezone bucketing keys (dayKeyLocal, monthKeyLocal, monthLabel,
// lastNMonthKeys) live in src/lib/format/dateKeys.ts, not here — they're the one
// group in this file with a real correctness invariant (every report's
// day/month grouping depends on bucketing by *local* midnight, not UTC),
// and that invariant deserves its own module and its own test file rather
// than sharing a grab-bag with formatters that have no invariant to guard.

import { activeDateLocale, type DateLocale } from './locale'

export type { DateLocale }

/**
 * "Jan 5, 2026, 2:30 PM" — short date + time (order rows, timestamps).
 * `locale` defaults to the active UI language's (see locale.ts), so a receipt
 * or WhatsApp message built outside React reads in the same language as its
 * translated labels. formatMonthYear/formatWeekdayShort below still require
 * it explicitly.
 */
export function formatDateTime(date: string | Date, locale: DateLocale = activeDateLocale()): string {
  return new Date(date).toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** "Jan 5, 2026" — short date only. Accepts Date or ISO string. */
export function formatDate(date: string | Date, locale: DateLocale = activeDateLocale()): string {
  return new Date(date).toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * "5 Jan 26" — day, short month, two-digit year: the narrowest unambiguous
 * date, for a column on a thermal receipt where "Jan 5, 2026" would wrap.
 * A bare 'YYYY-MM-DD' is read from its own parts, so the day can't shift with
 * the machine's timezone; any other string or Date goes through `new Date`.
 */
export function formatDateCompact(date: string | Date, locale: DateLocale = activeDateLocale()): string {
  const dateOnly = typeof date === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(date) : null
  const d = dateOnly ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])) : new Date(date)
  const month = d.toLocaleDateString(locale, { month: 'short' })
  return `${d.getDate()} ${month} ${String(d.getFullYear()).slice(-2)}`
}

/** "Monday, January 5, 2026" — long, weekday-prefixed date. Accepts Date or ISO string. */
export function formatDateLong(date: string | Date, locale: DateLocale = activeDateLocale()): string {
  return new Date(date).toLocaleDateString(locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

/** "2:30 PM" — time only. Accepts Date or ISO string. */
export function formatTime(date: string | Date, locale: DateLocale = activeDateLocale()): string {
  return new Date(date).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })
}

/**
 * "January 2026" — month + year, no day. Takes `locale` explicitly with no
 * default: this format only exists for one thing today (Expenses' month
 * filter dropdown), and that call site already varies by the active UI
 * language, so there's no "usually right" default to fall back on the way
 * the formatters above have one.
 */
export function formatMonthYear(date: string | Date, locale: DateLocale): string {
  return new Date(date).toLocaleDateString(locale, { month: 'long', year: 'numeric' })
}

/** "Mon" — short weekday name, for chart axis labels. Same no-default
 *  reasoning as formatMonthYear. */
export function formatWeekdayShort(date: Date, locale: DateLocale): string {
  return date.toLocaleDateString(locale, { weekday: 'short' })
}

// --- Period ranges (used by Reports / financial analysis) ---

export type Period = 'day' | 'week' | 'month' | 'year'

/** Half-open range: start inclusive, end exclusive. */
export interface DateRange {
  start: Date
  end: Date
}

/**
 * Local midnight of the Monday on or before `date` — the one declared
 * week-start for the whole app. Exported so every "this week" concept (the
 * Reports/Dashboard period filter below, and Appointments' week view, which
 * used to compute its own Monday-start week independently) shares one
 * definition instead of two that could silently disagree on which days a
 * "week" covers.
 */
export function startOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d
}

function periodStart(period: Period, now: Date): Date {
  switch (period) {
    case 'day':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate())
    case 'week':
      return startOfWeek(now)
    case 'month':
      return new Date(now.getFullYear(), now.getMonth(), 1)
    case 'year':
      return new Date(now.getFullYear(), 0, 1)
  }
}

/**
 * 23:59:59.999 local on `date`'s day — the `now` to hand getPeriodRange when a
 * screen outlives the moment it mounted. Ranges are half-open, so a mid-day
 * `end` would drop every order completed after the page opened.
 */
export function endOfDay(date: Date = new Date()): Date {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

/** Current period-to-date: [start of period, now). */
export function getPeriodRange(period: Period, now: Date = new Date()): DateRange {
  return { start: periodStart(period, now), end: now }
}

/** The full period before the current one: [start of previous, start of current). */
export function getPreviousPeriodRange(period: Period, now: Date = new Date()): DateRange {
  const end = periodStart(period, now)
  switch (period) {
    case 'day':
      return { start: new Date(end.getFullYear(), end.getMonth(), end.getDate() - 1), end }
    case 'week': {
      const start = new Date(end)
      start.setDate(start.getDate() - 7)
      return { start, end }
    }
    case 'month':
      return { start: new Date(end.getFullYear(), end.getMonth() - 1, 1), end }
    case 'year':
      return { start: new Date(end.getFullYear() - 1, 0, 1), end }
  }
}
