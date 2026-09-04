import { chartTheme } from '../../lib/chartTheme'

/**
 * `<Legend formatter={chartLegendFormatter} />` — the themed label every chart
 * with a Legend uses. Split out from chartTheme.ts (which stays JSX-free,
 * same convention as the rest of `src/lib`) because a Legend formatter must
 * return JSX, not a style object.
 */
export function chartLegendFormatter(value: string): JSX.Element {
  return <span style={{ color: chartTheme.fg3, fontSize: '12px' }}>{value}</span>
}
