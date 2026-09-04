import { memo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { chartTheme, chartTooltipStyle, chartAxis, chartAxisDense, chartAnimation } from '../../lib/chartTheme'
import { chartLegendFormatter } from '../charts/ChartLegend'
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

function BayThroughputChartImpl({ data, className = '' }: BayThroughputChartProps) {
  const { t } = useTranslation()
  const prefersReducedMotion = usePrefersReducedMotion()
  return (
    <div className={`h-64 ${className}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={3} barCategoryGap={10}>
          <XAxis dataKey="day" {...chartAxisDense} />
          <YAxis {...chartAxis} />
          <Tooltip {...chartTooltipStyle} />
          <Legend wrapperStyle={{ paddingTop: '16px' }} formatter={chartLegendFormatter} />
          <Bar dataKey="scheduled" name={t('dashboardWidgets.scheduled')} fill={chartTheme.accent} radius={[3, 3, 0, 0]} {...chartAnimation(prefersReducedMotion)} />
          <Bar dataKey="walkIn" name={t('dashboardWidgets.walkIn')} fill={chartTheme.info} radius={[3, 3, 0, 0]} {...chartAnimation(prefersReducedMotion)} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export const BayThroughputChart = memo(BayThroughputChartImpl)
