import { describe, expect, it } from 'vitest'
import { dailyKm, projectOdometer, readingsByVehicle, type OdometerReading } from '../schedule/odometerProjection'

const r = (date: string, km: number): OdometerReading => ({ date, km })

// A car driven 30 km a day: 3,000 km every 100 days.
const steady = [r('2026-01-01', 40_000), r('2026-04-11', 43_000), r('2026-07-20', 46_000)]

describe('dailyKm', () => {
  it('reads the rate off steady visits', () => {
    expect(dailyKm(steady)).toBeCloseTo(30, 0)
  })

  it('has no answer from a single reading', () => {
    expect(dailyKm([r('2026-01-01', 40_000)])).toBeNull()
    expect(dailyKm([])).toBeNull()
  })

  it('ignores visits too close together to say anything about the rate', () => {
    // 5 days apart, 400 km: that "80 km/day" is two readings, not a habit.
    expect(dailyKm([r('2026-01-01', 40_000), r('2026-01-06', 40_400)])).toBeNull()
  })

  it('ignores a reading that goes backwards (an odometer correction or typo)', () => {
    expect(dailyKm([r('2026-01-01', 50_000), r('2026-06-01', 41_000)])).toBeNull()
  })

  it('rejects an implausible rate — a mistyped extra digit', () => {
    expect(dailyKm([r('2026-01-01', 40_000), r('2026-03-01', 440_000)])).toBeNull()
  })

  it('is not thrown by one mistyped reading among good ones', () => {
    const withTypo = [
      r('2026-01-01', 40_000),
      r('2026-04-11', 43_000),
      r('2026-07-20', 4_600), // dropped a digit
      r('2026-10-28', 52_000),
      r('2027-02-05', 55_000),
    ]
    // The two segments touching the typo are skipped or distorted; the median holds.
    expect(dailyKm(withTypo)).toBeGreaterThan(20)
    expect(dailyKm(withTypo)).toBeLessThan(45)
  })

  it('uses recent driving, not a decade-old habit', () => {
    const old = [r('2010-01-01', 1_000), r('2010-07-01', 41_000)] // 220 km/day, long ago
    const recent = [r('2025-01-01', 90_000), r('2025-05-11', 94_000), r('2025-09-18', 98_000), r('2026-01-26', 102_000), r('2026-06-05', 106_000), r('2026-10-13', 110_000), r('2027-02-20', 114_000)]
    const rate = dailyKm([...old, ...recent])!
    // ~30 km/day from the recent visits; nowhere near the old 220.
    expect(rate).toBeGreaterThan(25)
    expect(rate).toBeLessThan(35)
  })

  it('counts two visits on one day once', () => {
    expect(dailyKm([r('2026-01-01', 40_000), r('2026-01-01', 40_050), r('2026-04-11', 43_000)])).toBeCloseTo(29.5, 0)
  })

  it('treats a stored instant as its LOCAL day', () => {
    // 00:30 local on the 11th: the UTC date can still be the 10th.
    const stamp = new Date(2026, 3, 11, 0, 30).toISOString()
    expect(dailyKm([r('2026-01-01', 40_000), { date: stamp, km: 43_000 }])).toBeCloseTo(30, 0)
  })
})

describe('projectOdometer', () => {
  const now = new Date(2026, 9, 28) // 100 days after the last visit (2026-07-20)

  it('carries the car forward at its usual rate since the last visit', () => {
    const p = projectOdometer(46_000, steady, now)
    expect(p.estimated).toBe(true)
    expect(p.km).toBeGreaterThan(48_500)
    expect(p.km).toBeLessThan(49_500)
  })

  it('reports the recorded mileage, unprojected, when the car was seen today', () => {
    expect(projectOdometer(46_000, steady, new Date(2026, 6, 20))).toEqual({ km: 46_000, estimated: false })
  })

  it('does not project from too little history', () => {
    expect(projectOdometer(46_000, [r('2026-07-20', 46_000)], now)).toEqual({ km: 46_000, estimated: false })
  })

  it('does not project a car with no readings at all', () => {
    expect(projectOdometer(12_345, [], now)).toEqual({ km: 12_345, estimated: false })
    expect(projectOdometer(null, [], now)).toEqual({ km: 0, estimated: false })
  })

  it('does not project when the mileage was edited by hand after the last visit', () => {
    // The stored figure is ahead of every visit: it has a date nobody recorded.
    expect(projectOdometer(47_500, steady, now)).toEqual({ km: 47_500, estimated: false })
  })

  it('stops extrapolating after two years rather than inventing a distance', () => {
    const far = projectOdometer(46_000, steady, new Date(2036, 0, 1))
    expect(far.km).toBeLessThan(46_000 + 30 * 740)
    expect(far.estimated).toBe(true)
  })

  it('never goes backwards', () => {
    expect(projectOdometer(46_000, steady, new Date(2025, 0, 1)).km).toBeGreaterThanOrEqual(46_000)
  })
})

describe('readingsByVehicle', () => {
  const order = (over: Record<string, unknown>) => ({
    vehicleId: 'v-1', status: 'completed', odometerAtService: null, odometerAtArrival: null,
    completedAt: '2026-03-01T03:00:00.000Z', createdAt: '2026-03-01T01:00:00.000Z', ...over,
  })

  it('takes the service reading, then the arrival reading, from completed visits only', () => {
    const map = readingsByVehicle([
      order({ odometerAtService: 50_100, odometerAtArrival: 50_000 }),
      order({ vehicleId: 'v-2', odometerAtArrival: 12_000 }),
      order({ vehicleId: 'v-3', status: 'open', odometerAtService: 9_000 }),
      order({ vehicleId: 'v-4', status: 'cancelled', odometerAtService: 9_000 }),
    ])
    expect(map.get('v-1')?.[0].km).toBe(50_100)
    expect(map.get('v-2')?.[0].km).toBe(12_000)
    expect(map.has('v-3')).toBe(false)
    expect(map.has('v-4')).toBe(false)
  })

  it('skips a visit with no usable reading', () => {
    const map = readingsByVehicle([order({}), order({ odometerAtService: 0 })])
    expect(map.has('v-1')).toBe(false)
  })

  it('returns each vehicle\'s readings oldest first, one per day', () => {
    const map = readingsByVehicle([
      order({ odometerAtService: 52_000, completedAt: '2026-06-01T05:00:00.000Z' }),
      order({ odometerAtService: 50_000, completedAt: '2026-03-01T05:00:00.000Z' }),
      order({ odometerAtService: 50_020, completedAt: '2026-03-01T08:00:00.000Z' }),
    ])
    expect(map.get('v-1')?.map((x) => x.km)).toEqual([50_020, 52_000])
  })
})
