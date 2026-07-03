import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceDot } from 'recharts'

interface TrendData {
  month: string
  appointments: number
}

interface AppointmentTrendChartProps {
  data: TrendData[]
  currentMonth?: string
  className?: string
}

export function AppointmentTrendChart({ data, currentMonth, className = '' }: AppointmentTrendChartProps) {
  const currentMonthData = currentMonth ? data.find(d => d.month === currentMonth) : null

  return (
    <div className={`h-48 ${className}`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="appointmentGradient" x1="0" y1="0" x2="0" y2="1">
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
          <Area
            type="monotone"
            dataKey="appointments"
            stroke="#a9dfd8"
            fill="url(#appointmentGradient)"
            strokeWidth={2}
            strokeDasharray="5 5"
          />
          {currentMonthData && (
            <ReferenceDot
              x={currentMonthData.month}
              y={currentMonthData.appointments}
              r={6}
              fill="#fcb859"
              stroke="#21222d"
              strokeWidth={2}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
