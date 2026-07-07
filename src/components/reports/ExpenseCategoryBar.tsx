import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { chartTheme } from '../../lib/chartTheme'
import { formatCompactIDR, formatCurrency } from '../../lib/currency'
import type { CategoryTotal } from '../../lib/finance'

interface ExpenseCategoryBarProps {
  data: CategoryTotal[]
  className?: string
}

export function ExpenseCategoryBar({ data, className = '' }: ExpenseCategoryBarProps) {
  return (
    <div className={className} style={{ height: Math.max(160, data.length * 36 + 24) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" barCategoryGap={8}>
          <XAxis
            type="number"
            axisLine={false}
            tickLine={false}
            tick={{ fill: chartTheme.fg3, fontSize: 11 }}
            tickFormatter={formatCompactIDR}
          />
          <YAxis
            type="category"
            dataKey="category"
            width={140}
            axisLine={false}
            tickLine={false}
            tick={{ fill: chartTheme.fg3, fontSize: 12 }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: chartTheme.bg2,
              border: `1px solid ${chartTheme.border2}`,
              borderRadius: '8px',
              color: chartTheme.fg1,
            }}
            labelStyle={{ color: chartTheme.fg3 }}
            formatter={(value, _name, item) => {
              const share = (item?.payload as CategoryTotal | undefined)?.sharePct
              const amount = formatCurrency(Number(value))
              return share === undefined ? amount : `${amount} · ${share.toFixed(1)}%`
            }}
            cursor={{ fill: chartTheme.border2, opacity: 0.25 }}
          />
          <Bar dataKey="amount" name="Amount" fill={chartTheme.danger} barSize={16} radius={[0, 3, 3, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
