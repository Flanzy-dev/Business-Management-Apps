// The odometer reading a visit actually recorded: the one taken at service wins
// (that is the figure the work was done at), the one taken on arrival is the
// fallback. Null when the visit recorded neither.
//
// Eleven places used to spell this out by hand. It is one rule; what each caller
// falls back to when a visit recorded nothing (the vehicle's own mileage, 0, null)
// differs, and stays with the caller.
export interface VisitOdometerFields {
  odometerAtService?: number | null
  odometerAtArrival?: number | null
}

export function visitOdometer(visit: VisitOdometerFields): number | null {
  return visit.odometerAtService ?? visit.odometerAtArrival ?? null
}
