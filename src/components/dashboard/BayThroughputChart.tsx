import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'

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
        <BarChart data={data} barGap={2}>
          <XAxis
            dataKey="day"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#8a8d98', fontSize: 12 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#8a8d98', fontSize: 12 }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#21222d',
              border: '1px solid #2b2b36',
              borderRadius: '8px',
              color: '#ffffff',
            }}
            labelStyle={{ color: '#8a8d98' }}
          />
          <Legend
            wrapperStyle={{ paddingTop: '16px' }}
            formatter={(value) => <span style={{ color: '#8a8d98', fontSize: '12px' }}>{value}</span>}
          />
          <Bar dataKey="scheduled" name="Scheduled" fill="#a9dfd8" radius={[4, 4, 0, 0]} />
          <Bar dataKey="walkIn" name="Walk-in" fill="#fcb859" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
