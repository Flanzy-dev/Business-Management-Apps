import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { chartTheme } from '../../lib/chartTheme'
import { useTranslation } from '../../lib/i18n'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'

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
  const { t } = useTranslation()
  const prefersReducedMotion = usePrefersReducedMotion()
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
          <Bar dataKey="scheduled" name={t('dashboardWidgets.scheduled')} fill={chartTheme.accent} radius={[3, 3, 0, 0]} isAnimationActive={!prefersReducedMotion} />
          <Bar dataKey="walkIn" name={t('dashboardWidgets.walkIn')} fill={chartTheme.info} radius={[3, 3, 0, 0]} isAnimationActive={!prefersReducedMotion} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
