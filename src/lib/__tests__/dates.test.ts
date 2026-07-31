import { describe, it, expect } from 'vitest'
import {
  getPeriodRange,
  getPreviousPeriodRange,
  monthKeyLocal,
  monthLabel,
  lastNMonthKeys,
} from '../dates'

// Wednesday, June 17, 2026, 14:30 local — fixed so tests never depend on the wall clock.
const now = new Date(2026, 5, 17, 14, 30)

describe('getPeriodRange', () => {
  it('day: starts at local midnight of today, ends at now (half-open)', () => {
    const range = getPeriodRange('day', now)
    expect(range.start.getTime()).toBe(new Date(2026, 5, 17).getTime())
    expect(range.end).toBe(now)
  })

  it('week: starts on SUNDAY of the current week', () => {
    const range = getPeriodRange('week', now)
    expect(range.start.getDay()).toBe(0)
    expect(range.start.getTime()).toBe(new Date(2026, 5, 14).getTime())
    expect(range.end).toBe(now)
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

describe('getPreviousPeriodRange', () => {
  it('month: covers the FULL previous month, ending where the current period starts', () => {
    const prev = getPreviousPeriodRange('month', now)
    expect(prev.start.getTime()).toBe(new Date(2026, 4, 1).getTime())
    expect(prev.end.getTime()).toBe(getPeriodRange('month', now).start.getTime())
  })

  it('week: covers the full previous Sunday-to-Sunday week', () => {
    const prev = getPreviousPeriodRange('week', now)
    expect(prev.start.getTime()).toBe(new Date(2026, 5, 7).getTime())
    expect(prev.end.getTime()).toBe(new Date(2026, 5, 14).getTime())
  })

  it('year: covers the full previous calendar year', () => {
    const prev = getPreviousPeriodRange('year', now)
    expect(prev.start.getTime()).toBe(new Date(2025, 0, 1).getTime())
    expect(prev.end.getTime()).toBe(new Date(2026, 0, 1).getTime())
  })
})

describe('monthKeyLocal', () => {
  it('uses local time, not UTC (no month shift near local midnight)', () => {
    // 00:30 local on Jan 1 is still Dec 31 in UTC for any UTC+ timezone —
    // the key must come from local fields.
    expect(monthKeyLocal(new Date(2026, 0, 1, 0, 30))).toBe('2026-01')
  })

  it('zero-pads the month', () => {
    expect(monthKeyLocal(new Date(2026, 2, 15))).toBe('2026-03')
  })
})

describe('monthLabel', () => {
  it("formats 'YYYY-MM' as short month + 2-digit year", () => {
    expect(monthLabel('2025-08')).toBe('Aug 25')
  })
})

describe('lastNMonthKeys', () => {
  it('crosses year boundaries, oldest first, ending with the current month', () => {
    expect(lastNMonthKeys(3, new Date(2026, 0, 15))).toEqual(['2025-11', '2025-12', '2026-01'])
  })

  it('returns exactly n keys', () => {
    expect(lastNMonthKeys(12, now)).toHaveLength(12)
    expect(lastNMonthKeys(12, now)[11]).toBe('2026-06')
  })
})
