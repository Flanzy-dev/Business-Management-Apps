// Estimating where a car's odometer is NOW, from where it was at each visit.
//
// A vehicle's stored mileage only changes when it visits, so a car that has
// simply not come back reads the same on day 400 as on day 1 — and never turns
// "due by distance", no matter how much it has been driven. The reminder list
// exists to bring those cars back, so it needs the estimate. Pure: callers pass
// the readings and the clock.
//
// Deliberately conservative. A wrong projection sends a customer a reminder they
// didn't need, which costs trust; a missed one costs one visit. So: no estimate
// from too little data, none from a rate nobody drives, and no extrapolating a
// car that has been gone for years.
import { dayKeyLocal, localDayOf } from '../format/dateKeys'
import { visitOdometer } from '../vehicles/visitOdometer'

export interface OdometerReading {
  /** 'YYYY-MM-DD' (a stored instant is converted to its local day). */
  date: string
  km: number
}

/** Ignore intervals shorter than this: a week between two visits says nothing
 *  about a year's driving, and a typo in either reading dominates the rate. */
const MIN_SEGMENT_DAYS = 14
/** How many of the most recent distinct-day readings the rate is taken from —
 *  how the car is driven now, not how it was driven ten years ago. */
const RATE_WINDOW = 6
/** Nobody legitimately drives more than this; a higher rate is a mistyped reading. */
const MAX_KM_PER_DAY = 300
/** Never project further than this past the last visit. */
const MAX_EXTRAPOLATION_DAYS = 730

const DAY_MS = 24 * 60 * 60 * 1000

/** Whole days since an arbitrary epoch, for a local 'YYYY-MM-DD'. */
function dayNumber(date: string): number {
  const [year, month, day] = localDayOf(date).split('-').map(Number)
  return Math.round(Date.UTC(year, month - 1, day) / DAY_MS)
}

/** Readings oldest first, one per day (the highest km that day). */
function distinctDayReadings(readings: OdometerReading[]): OdometerReading[] {
  const byDay = new Map<string, OdometerReading>()
  for (const r of readings) {
    const date = localDayOf(r.date)
    const kept = byDay.get(date)
    if (!kept || r.km > kept.km) byDay.set(date, { date, km: r.km })
  }
  return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date))
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/**
 * Kilometres per day this car is driven, or null when the readings can't say.
 * The median of the rate between each pair of consecutive recent visits — one
 * mistyped reading skews two segments, not the answer.
 */
export function dailyKm(readings: OdometerReading[]): number | null {
  const recent = distinctDayReadings(readings).slice(-RATE_WINDOW)
  const rates: number[] = []
  for (let i = 1; i < recent.length; i++) {
    const days = dayNumber(recent[i].date) - dayNumber(recent[i - 1].date)
    const gained = recent[i].km - recent[i - 1].km
    if (days < MIN_SEGMENT_DAYS || gained <= 0) continue
    const rate = gained / days
    if (rate <= MAX_KM_PER_DAY) rates.push(rate)
  }
  return rates.length > 0 ? median(rates) : null
}

export interface ProjectedOdometer {
  km: number
  /** True when `km` is an extrapolation rather than a recorded reading. */
  estimated: boolean
}

/**
 * Where the odometer probably is on `now`. Falls back to the stored mileage,
 * unprojected, whenever there is not enough to go on.
 */
export function projectOdometer(currentMileage: number | null, readings: OdometerReading[], now: Date): ProjectedOdometer {
  const known = currentMileage ?? 0
  const history = distinctDayReadings(readings)
  const last = history[history.length - 1]
  // A mileage typed in by hand AFTER the last visit has no date to project from.
  if (!last || known > last.km) return { km: known, estimated: false }

  const rate = dailyKm(history)
  if (rate === null) return { km: Math.max(known, last.km), estimated: false }

  const since = dayNumber(dayKeyLocal(now)) - dayNumber(last.date)
  const days = Math.min(Math.max(since, 0), MAX_EXTRAPOLATION_DAYS)
  if (days === 0) return { km: last.km, estimated: false }
  return { km: last.km + Math.round(rate * days), estimated: true }
}

interface OrderForReading {
  vehicleId: string
  status: string
  odometerAtService: number | null
  odometerAtArrival: number | null
  completedAt?: string | null
  createdAt: string
}

/**
 * Every vehicle's odometer readings, from its completed visits, in one pass —
 * for a caller covering all vehicles (the reminder list) instead of filtering
 * the whole order history per car.
 */
export function readingsByVehicle(orders: readonly OrderForReading[]): Map<string, OdometerReading[]> {
  const byVehicle = new Map<string, OdometerReading[]>()
  for (const order of orders) {
    if (order.status !== 'completed') continue
    const km = visitOdometer(order)
    if (km == null || km <= 0) continue
    const list = byVehicle.get(order.vehicleId) ?? []
    list.push({ date: localDayOf(order.completedAt || order.createdAt), km })
    byVehicle.set(order.vehicleId, list)
  }
  for (const [vehicleId, list] of byVehicle) byVehicle.set(vehicleId, distinctDayReadings(list))
  return byVehicle
}
