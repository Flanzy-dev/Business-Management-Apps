import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceDot, ReferenceLine } from 'recharts'
import { chartTheme } from '../../lib/chartTheme'

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
              <stop offset="5%" stopColor={chartTheme.accent} stopOpacity={0.3} />
              <stop offset="95%" stopColor={chartTheme.accent} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            tick={{ fill: chartTheme.fg3, fontSize: 12 }}
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
          <Area
            type="monotone"
            dataKey="appointments"
            stroke={chartTheme.accent}
            fill="url(#appointmentGradient)"
            strokeWidth={2.5}
          />
          {currentMonthData && (
            <>
              <ReferenceLine x={currentMonthData.month} stroke={chartTheme.border3} strokeDasharray="3 3" />
              <ReferenceDot
                x={currentMonthData.month}
                y={currentMonthData.appointments}
                r={4}
                fill={chartTheme.accent}
                stroke={chartTheme.bg2}
                strokeWidth={2}
              />
            </>
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
