import { describe, it, expect } from 'vitest'
import { monthKeyLocal, monthLabel, lastNMonthKeys, dayKeyLocal, daysFromNowKey } from '../dateKeys'

// Wednesday, June 17, 2026, 14:30 local — fixed so tests never depend on the wall clock.
const now = new Date(2026, 5, 17, 14, 30)

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

describe('dayKeyLocal', () => {
  // The bucketing invariant every report depends on: a sale made right
  // around local midnight must land in the calendar day/month a shop owner
  // actually experienced it on, not whatever UTC happens to say — this is
  // the exact thing that regressed when the revert this module's split was
  // extracted from broke src/lib/finance.ts's dayKeyLocal import.
  it('uses local time, not UTC, just after local midnight (no day shift for a UTC+ zone)', () => {
    // 00:30 local on Jan 1 is still Dec 31 in UTC for any UTC+ timezone.
    expect(dayKeyLocal(new Date(2026, 0, 1, 0, 30))).toBe('2026-01-01')
  })

  it('uses local time, not UTC, just before local midnight (no day shift for a UTC- zone)', () => {
    // 23:30 local on Dec 31 would already read as Jan 1 in UTC for any
    // UTC- timezone — the boundary check has to hold in both directions.
    expect(dayKeyLocal(new Date(2025, 11, 31, 23, 30))).toBe('2025-12-31')
  })

  it('zero-pads the month and day', () => {
    expect(dayKeyLocal(new Date(2026, 2, 5))).toBe('2026-03-05')
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

describe('daysFromNowKey', () => {
  it('adds the given number of days', () => {
    expect(daysFromNowKey(7, new Date(2026, 0, 1))).toBe('2026-01-08')
  })

  it('crosses a month boundary', () => {
    expect(daysFromNowKey(1, new Date(2026, 0, 31))).toBe('2026-02-01')
  })

  it('does not mutate the Date passed in', () => {
    const now = new Date(2026, 0, 1)
    daysFromNowKey(30, now)
    expect(now.getDate()).toBe(1)
  })

  it('defaults to today when no date is given', () => {
    expect(daysFromNowKey(0)).toBe(dayKeyLocal(new Date()))
  })
})
