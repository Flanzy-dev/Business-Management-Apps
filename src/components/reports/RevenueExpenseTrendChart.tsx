import {
  Bar,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { chartTheme, chartTooltipStyle, chartTooltipCursor, chartAxis, chartAxisDense, chartAnimation } from '../../lib/chartTheme'
import { chartLegendFormatter } from '../charts/ChartLegend'
import { formatCompactIDR, formatCurrency } from '../../lib/currency'
import type { MonthlyPnlPoint } from '../../lib/finance'
import { useTranslation } from '../../lib/i18n'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'

interface RevenueExpenseTrendChartProps {
  data: MonthlyPnlPoint[]
  className?: string
}

export function RevenueExpenseTrendChart({ data, className = '' }: RevenueExpenseTrendChartProps) {
  const { t } = useTranslation()
  const prefersReducedMotion = usePrefersReducedMotion()
  const hasLoss = data.some(p => p.netProfit < 0)
  return (
    <div className={`h-72 ${className}`}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} barGap={3} barCategoryGap={12}>
          <XAxis dataKey="month" {...chartAxisDense} />
          <YAxis {...chartAxis} width={80} tickFormatter={formatCompactIDR} />
          <Tooltip {...chartTooltipStyle} formatter={(value) => formatCurrency(Number(value))} cursor={chartTooltipCursor} />
          <Legend wrapperStyle={{ paddingTop: '16px' }} formatter={chartLegendFormatter} />
          {hasLoss && <ReferenceLine y={0} stroke={chartTheme.border3} />}
          <Bar dataKey="revenue" name={t('reportsWidgets.revenue')} fill={chartTheme.success} radius={[3, 3, 0, 0]} {...chartAnimation(prefersReducedMotion)} />
          <Bar dataKey="expenses" name={t('reportsWidgets.expenses')} fill={chartTheme.danger} radius={[3, 3, 0, 0]} {...chartAnimation(prefersReducedMotion)} />
          <Line
            type="monotone"
            dataKey="netProfit"
            name={t('reportsWidgets.netProfit')}
            stroke={chartTheme.accent}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4 }}
            {...chartAnimation(prefersReducedMotion)}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
