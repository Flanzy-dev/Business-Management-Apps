// StatCard's delta-tone/prefix rules, pulled out of the component body —
// same "real rules belong in a plain .ts, not a component body" reasoning as
// every other *Form.ts-shaped module in this codebase.
export type DeltaTone = 'up' | 'down' | 'neutral'

/**
 * A caller-supplied tone always wins — used for "bad-direction" metrics
 * (e.g. an increase in vehicles-due is a bad sign, see DESIGN.md §5.1's
 * "Vehicles due 7d" example). With nothing supplied, the sign of the delta
 * itself decides; `undefined` (no baseline at all) renders no badge.
 */
export function resolveDeltaTone(delta: number | null | undefined, override?: DeltaTone): DeltaTone | undefined {
  if (override) return override
  if (delta == null) return undefined
  return delta >= 0 ? 'up' : 'down'
}

/** A leading "+" on a positive delta; nothing on zero, negative, or absent. */
export function deltaPrefix(delta: number | null | undefined): string {
  return delta != null && delta > 0 ? '+' : ''
}
