import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { chartTheme } from '../../lib/chartTheme'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'

interface RankedBarChartProps {
  data: { label: string; value: number }[]
  valueFormatter?: (value: number) => string
  barColor?: string
  className?: string
}

export function RankedBarChart({ data, valueFormatter, barColor = chartTheme.accent, className = '' }: RankedBarChartProps) {
  const prefersReducedMotion = usePrefersReducedMotion()
  const format = valueFormatter ?? ((v: number) => v.toLocaleString())
  return (
    <div className={className} style={{ height: Math.max(160, data.length * 36 + 24) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" barCategoryGap={8}>
          <XAxis
            type="number"
            axisLine={false}
            tickLine={false}
            tick={{ fill: chartTheme.fg3, fontSize: 11 }}
            tickFormatter={format}
          />
          <YAxis
            type="category"
            dataKey="label"
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
            formatter={(value) => format(Number(value))}
            cursor={{ fill: chartTheme.border2, opacity: 0.25 }}
          />
          <Bar dataKey="value" fill={barColor} barSize={16} radius={[0, 3, 3, 0]} isAnimationActive={!prefersReducedMotion} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
