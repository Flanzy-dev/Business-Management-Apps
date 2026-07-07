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
import { chartTheme } from '../../lib/chartTheme'
import { formatCompactIDR, formatCurrency } from '../../lib/currency'
import type { MonthlyPnlPoint } from '../../lib/finance'

interface RevenueExpenseTrendChartProps {
  data: MonthlyPnlPoint[]
  className?: string
}

export function RevenueExpenseTrendChart({ data, className = '' }: RevenueExpenseTrendChartProps) {
  const hasLoss = data.some(p => p.netProfit < 0)
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
            axisLine={false}
            tickLine={false}
            width={80}
            tick={{ fill: chartTheme.fg3, fontSize: 12 }}
            tickFormatter={formatCompactIDR}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: chartTheme.bg2,
              border: `1px solid ${chartTheme.border2}`,
              borderRadius: '8px',
              color: chartTheme.fg1,
            }}
            labelStyle={{ color: chartTheme.fg3 }}
            formatter={(value) => formatCurrency(Number(value))}
            cursor={{ fill: chartTheme.border2, opacity: 0.25 }}
          />
          <Legend
            wrapperStyle={{ paddingTop: '16px' }}
            formatter={(value) => <span style={{ color: chartTheme.fg3, fontSize: '12px' }}>{value}</span>}
          />
          {hasLoss && <ReferenceLine y={0} stroke={chartTheme.border3} />}
          <Bar dataKey="revenue" name="Revenue" fill={chartTheme.success} radius={[3, 3, 0, 0]} />
          <Bar dataKey="expenses" name="Expenses" fill={chartTheme.danger} radius={[3, 3, 0, 0]} />
          <Line
            type="monotone"
            dataKey="netProfit"
            name="Net Profit"
            stroke={chartTheme.accent}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
