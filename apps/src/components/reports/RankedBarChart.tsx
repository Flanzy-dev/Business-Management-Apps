import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { chartTheme, chartTooltipStyle, chartTooltipCursor, chartAxis, chartAxisDense, chartAnimation } from '../../lib/app/chartTheme'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import { useTranslation } from '../../lib/i18n'
import { formatNumber } from '../../lib/format/numbers'

interface RankedBarChartRow {
  label: string
  value: number
  /** Extra per-row data a tooltipFormatter needs (e.g. a share percentage) —
   *  opaque to this component, passed straight to the formatter. */
  meta?: unknown
}

interface RankedBarChartProps {
  data: RankedBarChartRow[]
  valueFormatter?: (value: number) => string
  /** Overrides valueFormatter for the tooltip specifically, when the tooltip
   *  needs more than the bare value (e.g. "Rp80.000 · 23.5%" from `meta`). */
  tooltipFormatter?: (value: number, row: RankedBarChartRow) => string
  barColor?: string
  barName?: string
  className?: string
}

export function RankedBarChart({ data, valueFormatter, tooltipFormatter, barColor = chartTheme.accent, barName, className = '' }: RankedBarChartProps) {
  const { t } = useTranslation()
  const prefersReducedMotion = usePrefersReducedMotion()
  const format = valueFormatter ?? formatNumber
  // The bars are drawn, not text: give assistive tech the gist (size + the
  // leader) so the chart isn't a silent gap. Exact values stay in the tooltip.
  const top = data.reduce<RankedBarChartRow | null>((best, row) => (best === null || row.value > best.value ? row : best), null)
  const summary = top
    ? t('charts.rankedSummary', { count: data.length, label: top.label, value: format(top.value) })
    : undefined
  return (
    <div
      className={className}
      style={{ height: Math.max(160, data.length * 36 + 24) }}
      role={summary ? 'img' : undefined}
      aria-label={summary}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" barCategoryGap={8}>
          <XAxis type="number" {...chartAxisDense} tickFormatter={format} />
          <YAxis type="category" dataKey="label" width={140} {...chartAxis} />
          <Tooltip
            {...chartTooltipStyle}
            formatter={(value, _name, item) =>
              tooltipFormatter ? tooltipFormatter(Number(value), item?.payload as RankedBarChartRow) : format(Number(value))
            }
            cursor={chartTooltipCursor}
          />
          <Bar dataKey="value" name={barName} fill={barColor} barSize={16} radius={[0, 3, 3, 0]} {...chartAnimation(prefersReducedMotion)} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
