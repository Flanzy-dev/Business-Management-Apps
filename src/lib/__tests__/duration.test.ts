import { describe, it, expect } from 'vitest'
import { describeMinutesRemaining, minutesUntil } from '../duration'

describe('describeMinutesRemaining', () => {
  it('is overdue at exactly zero', () => {
    expect(describeMinutesRemaining(0)).toEqual({ kind: 'overdue' })
  })

  it('is overdue for a negative value (Bays.tsx-style diff, not just the -1 sentinel)', () => {
    expect(describeMinutesRemaining(-5)).toEqual({ kind: 'overdue' })
  })

  it('is overdue for dashboardMetrics.ts\'s -1 sentinel', () => {
    expect(describeMinutesRemaining(-1)).toEqual({ kind: 'overdue' })
  })

  it('is minutes-only under an hour', () => {
    expect(describeMinutesRemaining(45)).toEqual({ kind: 'minutes', minutes: 45 })
  })

  it('is minutes-only right up to 59', () => {
    expect(describeMinutesRemaining(59)).toEqual({ kind: 'minutes', minutes: 59 })
  })

  it('switches to hours+minutes at exactly 60', () => {
    expect(describeMinutesRemaining(60)).toEqual({ kind: 'hoursMinutes', hours: 1, minutes: 0 })
  })

  it('splits hours and minutes correctly for a large value', () => {
    expect(describeMinutesRemaining(125)).toEqual({ kind: 'hoursMinutes', hours: 2, minutes: 5 })
  })
})

describe('minutesUntil', () => {
  it('rounds up a partial minute', () => {
    const now = new Date('2026-01-01T00:00:00.000Z')
    const end = new Date('2026-01-01T00:00:30.000Z') // 30s away
    expect(minutesUntil(end, now)).toBe(1)
  })

  it('returns 0 when end has just passed', () => {
    const now = new Date('2026-01-01T00:00:00.000Z')
    const end = new Date('2026-01-01T00:00:00.000Z')
    expect(minutesUntil(end, now)).toBe(0)
  })

  it('returns a negative count when end is in the past', () => {
    const now = new Date('2026-01-01T00:10:00.000Z')
    const end = new Date('2026-01-01T00:00:00.000Z')
    expect(minutesUntil(end, now)).toBe(-10)
  })
})
