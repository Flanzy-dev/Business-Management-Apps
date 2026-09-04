// Literal hex mirrors of the Surya Baru CSS custom properties (src/index.css),
// for Recharts props that need literal color strings rather than var()/classes.
export const chartTheme = {
  accent: '#ffb224',
  accentHover: '#ffc14d',
  success: '#3ecf8e',
  warning: '#ffb224',
  danger: '#f2555a',
  info: '#4d9fff',
  violet: '#a684ff',
  fg1: '#e9eef5',
  fg3: '#7e8b9c',
  bg2: '#151b23',
  border2: '#2b3644',
  border3: '#3b4859',
  // Auto-assigned slice colors for donut/category charts with an
  // unbounded number of categories (e.g. inventory categories).
  categorical: ['#ffb224', '#4d9fff', '#3ecf8e', '#f2555a', '#a684ff', '#7e8b9c'],
}

// Prop presets below this line, for the Recharts elements every chart in the
// app repeats identically (fallow flagged 9 files duplicating these blocks
// pairwise). Spread directly onto the element: `<Tooltip {...chartTooltipStyle} />`,
// `<XAxis {...chartAxisDense} dataKey="month" />`. The Legend formatter needs
// JSX, so it lives in the sibling `src/components/charts/ChartLegend.tsx`
// instead of here — this file stays JSX-free like the rest of `src/lib`.

/** `<Tooltip {...chartTooltipStyle} />` — the dark tooltip box every chart uses. */
export const chartTooltipStyle = {
  contentStyle: {
    backgroundColor: chartTheme.bg2,
    border: `1px solid ${chartTheme.border2}`,
    borderRadius: '8px',
    color: chartTheme.fg1,
  },
  labelStyle: { color: chartTheme.fg3 },
}

/** `<Tooltip cursor={chartTooltipCursor} />` — the hover-column highlight on bar charts. */
export const chartTooltipCursor = { fill: chartTheme.border2, opacity: 0.25 }

/** `<YAxis {...chartAxis} />` — value axes (fontSize 12). */
export const chartAxis = {
  axisLine: false,
  tickLine: false,
  tick: { fill: chartTheme.fg3, fontSize: 12 },
}

/** `<XAxis {...chartAxisDense} />` — category axes, one size down (fontSize 11). */
export const chartAxisDense = {
  axisLine: false,
  tickLine: false,
  tick: { fill: chartTheme.fg3, fontSize: 11 },
}

/**
 * `<Bar {...chartAnimation(prefersReducedMotion)} />` — every chart animates
 * the same way when motion is allowed. Not used by
 * ServiceHistoryTimelineChart, which deliberately disables animation outright.
 */
export function chartAnimation(prefersReducedMotion: boolean): { isAnimationActive: boolean; animationDuration: number } {
  return { isAnimationActive: !prefersReducedMotion, animationDuration: 300 }
}
