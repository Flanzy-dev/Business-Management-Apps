import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { chartTheme } from '../../lib/chartTheme'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'

interface DonutBreakdownProps {
  data: { label: string; value: number; color?: string }[]
  valueFormatter?: (value: number) => string
  className?: string
}

export function DonutBreakdown({ data, valueFormatter, className = '' }: DonutBreakdownProps) {
  const prefersReducedMotion = usePrefersReducedMotion()
  const format = valueFormatter ?? ((v: number) => v.toLocaleString())
  const segments = data.filter((d) => d.value > 0)

  if (segments.length === 0) return null

  return (
    <div className={`h-64 ${className}`}>
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
            isAnimationActive={!prefersReducedMotion}
          >
            {segments.map((entry, i) => (
              <Cell key={entry.label} fill={entry.color ?? chartTheme.categorical[i % chartTheme.categorical.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: chartTheme.bg2,
              border: `1px solid ${chartTheme.border2}`,
              borderRadius: '8px',
              color: chartTheme.fg1,
            }}
            labelStyle={{ color: chartTheme.fg3 }}
            formatter={(value) => format(Number(value))}
          />
          <Legend
            layout="vertical"
            align="right"
            verticalAlign="middle"
            formatter={(value) => <span style={{ color: chartTheme.fg3, fontSize: '12px' }}>{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
