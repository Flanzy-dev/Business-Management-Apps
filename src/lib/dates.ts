// Shared date/time formatters — one place for the app's date presentation,
// replacing the several ad-hoc `formatDate` helpers previously copied across
// pages. Output stays en-US for now (locale change is a separate task).

/** "Jan 5, 2026, 2:30 PM" — short date + time (order rows, timestamps). */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** "Jan 5, 2026" — short date only. */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/** "Monday, January 5, 2026" — long, weekday-prefixed date. Accepts Date or ISO string. */
export function formatDateLong(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

/** "2:30 PM" — time only. */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

// --- Period ranges & month bucketing (used by Reports / financial analysis) ---

export type Period = 'day' | 'week' | 'month' | 'year'

/** Half-open range: start inclusive, end exclusive. */
export interface DateRange {
  start: Date
  end: Date
}

function periodStart(period: Period, now: Date): Date {
  switch (period) {
    case 'day':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate())
    case 'week': {
      // Week starts Sunday, matching the existing Reports period filter.
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      d.setDate(d.getDate() - d.getDay())
      return d
    }
    case 'month':
      return new Date(now.getFullYear(), now.getMonth(), 1)
    case 'year':
      return new Date(now.getFullYear(), 0, 1)
  }
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

/** The last n month keys, oldest → newest, ending with the current month. */
export function lastNMonthKeys(n: number, now: Date = new Date()): string[] {
  const keys: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    keys.push(monthKeyLocal(new Date(now.getFullYear(), now.getMonth() - i, 1)))
  }
  return keys
}
