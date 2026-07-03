import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface RepeatData {
  month: string
  lastMonth: number
  thisMonth: number
}

interface RepeatCustomerChartProps {
  data: RepeatData[]
  className?: string
}

export function RepeatCustomerChart({ data, className = '' }: RepeatCustomerChartProps) {
  return (
    <div className={`h-48 ${className}`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="lastMonthGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f2c8ed" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#f2c8ed" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="thisMonthGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#a9dfd8" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#a9dfd8" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#8a8d98', fontSize: 12 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#8a8d98', fontSize: 12 }}
            tickFormatter={(value) => `${value}%`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#21222d',
              border: '1px solid #2b2b36',
              borderRadius: '8px',
              color: '#ffffff',
            }}
            labelStyle={{ color: '#8a8d98' }}
            formatter={(value) => [`${value}%`, '']}
          />
          <Area
            type="monotone"
            dataKey="lastMonth"
            name="Last Month"
            stroke="#f2c8ed"
            fill="url(#lastMonthGradient)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="thisMonth"
            name="This Month"
            stroke="#a9dfd8"
            fill="url(#thisMonthGradient)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
