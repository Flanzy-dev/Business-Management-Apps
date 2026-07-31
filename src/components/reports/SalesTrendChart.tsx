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
import { chartTheme } from '../../lib/chartTheme'
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
          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            tick={{ fill: chartTheme.fg3, fontSize: 11 }}
          />
          <YAxis
            yAxisId="revenue"
            axisLine={false}
            tickLine={false}
            width={80}
            tick={{ fill: chartTheme.fg3, fontSize: 12 }}
            tickFormatter={formatCompactIDR}
          />
          <YAxis
            yAxisId="orders"
            orientation="right"
            axisLine={false}
            tickLine={false}
            width={40}
            tick={{ fill: chartTheme.fg3, fontSize: 12 }}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: chartTheme.bg2,
              border: `1px solid ${chartTheme.border2}`,
              borderRadius: '8px',
              color: chartTheme.fg1,
            }}
            labelStyle={{ color: chartTheme.fg3 }}
            formatter={(value, name) => (name === orderCountLabel ? Number(value) : formatCurrency(Number(value)))}
            cursor={{ fill: chartTheme.border2, opacity: 0.25 }}
          />
          <Legend
            wrapperStyle={{ paddingTop: '16px' }}
            formatter={(value) => <span style={{ color: chartTheme.fg3, fontSize: '12px' }}>{value}</span>}
          />
          <Bar yAxisId="revenue" dataKey="revenue" name={revenueLabel} fill={chartTheme.success} radius={[3, 3, 0, 0]} isAnimationActive={!prefersReducedMotion} />
          <Line
            yAxisId="orders"
            type="monotone"
            dataKey="orderCount"
            name={orderCountLabel}
            stroke={chartTheme.accent}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4 }}
            isAnimationActive={!prefersReducedMotion}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
