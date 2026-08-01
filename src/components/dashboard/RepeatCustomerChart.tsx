import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { chartTheme } from '../../lib/chartTheme'
import { useTranslation } from '../../lib/i18n'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'

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
  const { t } = useTranslation()
  const prefersReducedMotion = usePrefersReducedMotion()
  return (
    <div className={`h-48 ${className}`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="thisMonthGradient" x1="0" y1="0" x2="0" y2="1">
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
            tickFormatter={(value) => `${value}%`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: chartTheme.bg2,
              border: `1px solid ${chartTheme.border2}`,
              borderRadius: '8px',
              color: chartTheme.fg1,
            }}
            labelStyle={{ color: chartTheme.fg3 }}
            formatter={(value) => [`${value}%`, '']}
          />
          {/* Last month — line only, no fill (DESIGN.md §5.1) */}
          <Area
            type="monotone"
            dataKey="lastMonth"
            name={t('dashboardWidgets.lastMonth')}
            stroke={chartTheme.fg3}
            fill="none"
            strokeWidth={2}
            isAnimationActive={!prefersReducedMotion}
          />
          {/* This month — filled area + heavier accent line */}
          <Area
            type="monotone"
            dataKey="thisMonth"
            name={t('dashboardWidgets.thisMonth')}
            stroke={chartTheme.accent}
            fill="url(#thisMonthGradient)"
            strokeWidth={2.5}
            isAnimationActive={!prefersReducedMotion}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
