import { describe, it, expect } from 'vitest'
import { getPeriodRange, getPreviousPeriodRange, startOfWeek } from '../dates'

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
