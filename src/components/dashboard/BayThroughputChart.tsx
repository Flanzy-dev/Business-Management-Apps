import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { chartTheme } from '../../lib/chartTheme'

interface ThroughputData {
  day: string
  scheduled: number
  walkIn: number
}

interface BayThroughputChartProps {
  data: ThroughputData[]
  className?: string
}

export function BayThroughputChart({ data, className = '' }: BayThroughputChartProps) {
  return (
    <div className={`h-64 ${className}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={3} barCategoryGap={10}>
          <XAxis
            dataKey="day"
            axisLine={false}
            tickLine={false}
            tick={{ fill: chartTheme.fg3, fontSize: 11 }}
          />
          <YAxis
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
          />
          <Legend
            wrapperStyle={{ paddingTop: '16px' }}
            formatter={(value) => <span style={{ color: chartTheme.fg3, fontSize: '12px' }}>{value}</span>}
          />
          <Bar dataKey="scheduled" name="Scheduled" fill={chartTheme.accent} radius={[3, 3, 0, 0]} />
          <Bar dataKey="walkIn" name="Walk-in" fill={chartTheme.info} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
