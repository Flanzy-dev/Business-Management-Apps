import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { chartTheme, chartTooltipStyle, chartAnimation } from '../../lib/app/chartTheme'
import { chartLegendFormatter } from '../charts/ChartLegend'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import { useTranslation } from '../../lib/i18n'
import { formatNumber } from '../../lib/format/numbers'

interface DonutBreakdownProps {
  data: { label: string; value: number; color?: string }[]
  valueFormatter?: (value: number) => string
  className?: string
}

export function DonutBreakdown({ data, valueFormatter, className = '' }: DonutBreakdownProps) {
  const { t } = useTranslation()
  const prefersReducedMotion = usePrefersReducedMotion()
  const format = valueFormatter ?? formatNumber
  const segments = data.filter((d) => d.value > 0)

  if (segments.length === 0) return null

  const largest = segments.reduce((best, s) => (s.value > best.value ? s : best), segments[0])
  const summary = t('charts.donutSummary', { count: segments.length, label: largest.label, value: format(largest.value) })

  return (
    <div className={`h-64 ${className}`} role="img" aria-label={summary}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={segments}
            dataKey="value"
            nameKey="label"
            innerRadius="55%"
            outerRadius="80%"
            paddingAngle={2}
            stroke="none"
            {...chartAnimation(prefersReducedMotion)}
          >
            {segments.map((entry, i) => (
              <Cell key={entry.label} fill={entry.color ?? chartTheme.categorical[i % chartTheme.categorical.length]} />
            ))}
          </Pie>
          <Tooltip {...chartTooltipStyle} formatter={(value) => format(Number(value))} />
          <Legend layout="vertical" align="right" verticalAlign="middle" formatter={chartLegendFormatter} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
