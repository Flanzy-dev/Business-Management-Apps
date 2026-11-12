import { describe, it, expect } from 'vitest'
import { endOfDay, getPeriodRange, getPreviousPeriodRange, startOfWeek, formatDateTime, formatDateCompact, formatDateLong, formatMonthYear, formatWeekdayShort } from '../format/dates'

// Wednesday, June 17, 2026, 14:30 local — fixed so tests never depend on the wall clock.
const now = new Date(2026, 5, 17, 14, 30)

describe('getPeriodRange', () => {
  it('day: starts at local midnight of today, ends at now (half-open)', () => {
    const range = getPeriodRange('day', now)
    expect(range.start.getTime()).toBe(new Date(2026, 5, 17).getTime())
    expect(range.end).toBe(now)
  })

  it('week: starts on MONDAY of the current week', () => {
    const range = getPeriodRange('week', now)
    expect(range.start.getDay()).toBe(1)
    expect(range.start.getTime()).toBe(new Date(2026, 5, 15).getTime())
    expect(range.end).toBe(now)
  })

  it('week: matches startOfWeek exactly — the one declared definition of "this week"', () => {
    // Appointments.tsx used to compute its own Monday-start week
    // independently of this period filter; this pins them to the same range
    // so "this week" can never mean two different date spans in the app.
    const range = getPeriodRange('week', now)
    expect(range.start.getTime()).toBe(startOfWeek(now).getTime())
  })

  it('month: starts on the 1st of the current month', () => {
    const range = getPeriodRange('month', now)
    expect(range.start.getTime()).toBe(new Date(2026, 5, 1).getTime())
  })

  it('year: starts on January 1 of the current year', () => {
    const range = getPeriodRange('year', now)
    expect(range.start.getTime()).toBe(new Date(2026, 0, 1).getTime())
  })
})

describe('endOfDay', () => {
  it('is the last millisecond of the same local day', () => {
    const end = endOfDay(now)
    expect(end.getFullYear()).toBe(2026)
    expect(end.getMonth()).toBe(5)
    expect(end.getDate()).toBe(17)
    expect(end.getHours()).toBe(23)
    expect(end.getMinutes()).toBe(59)
    expect(end.getMilliseconds()).toBe(999)
  })

  it('does not mutate its argument', () => {
    const before = now.getTime()
    endOfDay(now)
    expect(now.getTime()).toBe(before)
  })

  it('keeps an order completed after "now" inside the day range', () => {
    const range = getPeriodRange('day', endOfDay(now))
    const lateOrder = new Date(2026, 5, 17, 18, 0)
    expect(lateOrder.getTime()).toBeLessThan(range.end.getTime())
    expect(lateOrder.getTime()).toBeGreaterThanOrEqual(range.start.getTime())
  })
})

describe('getPreviousPeriodRange', () => {
  it('month: covers the FULL previous month, ending where the current period starts', () => {
    const prev = getPreviousPeriodRange('month', now)
    expect(prev.start.getTime()).toBe(new Date(2026, 4, 1).getTime())
    expect(prev.end.getTime()).toBe(getPeriodRange('month', now).start.getTime())
  })

  it('week: covers the full previous Monday-to-Monday week', () => {
    const prev = getPreviousPeriodRange('week', now)
    expect(prev.start.getTime()).toBe(new Date(2026, 5, 8).getTime())
    expect(prev.end.getTime()).toBe(new Date(2026, 5, 15).getTime())
  })

  it('year: covers the full previous calendar year', () => {
    const prev = getPreviousPeriodRange('year', now)
    expect(prev.start.getTime()).toBe(new Date(2025, 0, 1).getTime())
    expect(prev.end.getTime()).toBe(new Date(2026, 0, 1).getTime())
  })
})

describe('formatDateTime', () => {
  it('renders month, day, year, hour and minute', () => {
    expect(formatDateTime(new Date(2026, 0, 5, 14, 30))).toBe('Jan 5, 2026, 2:30 PM')
  })

  it('accepts an ISO string the same as a Date', () => {
    expect(formatDateTime('2026-01-05T14:30:00')).toBe(formatDateTime(new Date(2026, 0, 5, 14, 30)))
  })
})

describe('formatDateCompact', () => {
  it('prints day, short month and a two-digit year', () => {
    expect(formatDateCompact('2027-03-12')).toBe('12 Mar 27')
    expect(formatDateCompact('2026-01-05')).toBe('5 Jan 26')
  })

  it('reads a bare date from its own parts, so the day never shifts', () => {
    expect(formatDateCompact('2026-12-31')).toBe('31 Dec 26')
    expect(formatDateCompact('2027-01-01')).toBe('1 Jan 27')
  })

  it('accepts a Date', () => {
    expect(formatDateCompact(new Date(2026, 9, 25))).toBe('25 Oct 26')
  })
})

describe('formatDateLong', () => {
  it('renders the full weekday-prefixed long form', () => {
    // 2026-01-05 is a Monday.
    expect(formatDateLong(new Date(2026, 0, 5))).toBe('Monday, January 5, 2026')
  })
})

describe('formatMonthYear', () => {
  it('renders month and year with no day, in the given locale', () => {
    expect(formatMonthYear(new Date(2026, 0, 5), 'en-US')).toBe('January 2026')
  })

  it("has no default locale — Expenses' filter is the one caller and always passes the active language", () => {
    expect(formatMonthYear(new Date(2026, 0, 5), 'id-ID')).toBe('Januari 2026')
  })
})

describe('formatWeekdayShort', () => {
  it('renders the short weekday name in the given locale', () => {
    // 2026-01-05 is a Monday.
    expect(formatWeekdayShort(new Date(2026, 0, 5), 'en-US')).toBe('Mon')
  })

  it('has no default locale, same reasoning as formatMonthYear', () => {
    expect(formatWeekdayShort(new Date(2026, 0, 5), 'id-ID')).toBe('Sen')
  })
})
