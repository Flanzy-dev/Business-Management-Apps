import { describe, expect, it } from 'vitest'
import { visitOdometer } from '../vehicles/visitOdometer'

describe('visitOdometer', () => {
  it('prefers the reading taken at service over the one taken on arrival', () => {
    expect(visitOdometer({ odometerAtService: 50_120, odometerAtArrival: 50_100 })).toBe(50_120)
  })

  it('falls back to the arrival reading', () => {
    expect(visitOdometer({ odometerAtService: null, odometerAtArrival: 50_100 })).toBe(50_100)
  })

  it('is null when the visit recorded neither', () => {
    expect(visitOdometer({ odometerAtService: null, odometerAtArrival: null })).toBeNull()
    expect(visitOdometer({})).toBeNull()
  })

  it('keeps a recorded 0 rather than treating it as missing', () => {
    // ?? not || : a brand-new car's 0 km is a reading.
    expect(visitOdometer({ odometerAtService: 0, odometerAtArrival: 12 })).toBe(0)
  })
})
