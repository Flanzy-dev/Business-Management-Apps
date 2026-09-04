import {
  Bar,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { chartTheme, chartTooltipStyle, chartTooltipCursor, chartAxis, chartAxisDense, chartAnimation } from '../../lib/chartTheme'
import { chartLegendFormatter } from '../charts/ChartLegend'
import { formatCompactIDR, formatCurrency } from '../../lib/currency'
import type { MonthlySalesPoint } from '../../lib/finance'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'

interface SalesTrendChartProps {
  data: MonthlySalesPoint[]
  revenueLabel: string
  orderCountLabel: string
  className?: string
}

export function SalesTrendChart({ data, revenueLabel, orderCountLabel, className = '' }: SalesTrendChartProps) {
  const prefersReducedMotion = usePrefersReducedMotion()
  return (
    <div className={`h-72 ${className}`}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} barGap={3} barCategoryGap={12}>
          <XAxis dataKey="month" {...chartAxisDense} />
          <YAxis yAxisId="revenue" {...chartAxis} width={80} tickFormatter={formatCompactIDR} />
          <YAxis yAxisId="orders" orientation="right" {...chartAxis} width={40} allowDecimals={false} />
          <Tooltip
            {...chartTooltipStyle}
            formatter={(value, name) => (name === orderCountLabel ? Number(value) : formatCurrency(Number(value)))}
            cursor={chartTooltipCursor}
          />
          <Legend wrapperStyle={{ paddingTop: '16px' }} formatter={chartLegendFormatter} />
          <Bar yAxisId="revenue" dataKey="revenue" name={revenueLabel} fill={chartTheme.success} radius={[3, 3, 0, 0]} {...chartAnimation(prefersReducedMotion)} />
          <Line
            yAxisId="orders"
            type="monotone"
            dataKey="orderCount"
            name={orderCountLabel}
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
