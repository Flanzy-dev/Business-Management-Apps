import { memo } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { chartTheme, chartTooltipStyle, chartAxis, chartAnimation } from '../../lib/chartTheme'
import { useTranslation } from '../../lib/i18n'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'

interface RepeatData {
  month: string
  /** Repeat-customer rate 0-100 (repeat orders / all orders that week). */
  lastMonth: number
  thisMonth: number
  lastMonthRepeat: number
  lastMonthTotal: number
  thisMonthRepeat: number
  thisMonthTotal: number
}

interface RepeatCustomerChartProps {
  data: RepeatData[]
  className?: string
}

function RepeatCustomerChartImpl({ data, className = '' }: RepeatCustomerChartProps) {
  const { t } = useTranslation()
  const prefersReducedMotion = usePrefersReducedMotion()
  // Tooltip: a bare rate hides that "100%" might be 1-of-1 — show the volume.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formatEntry = (value: any, _name: any, entry: any): [string, string] => {
    const p = entry?.payload as RepeatData | undefined
    const isThis = entry?.dataKey === 'thisMonth'
    const repeat = (isThis ? p?.thisMonthRepeat : p?.lastMonthRepeat) ?? 0
    const total = (isThis ? p?.thisMonthTotal : p?.lastMonthTotal) ?? 0
    return [t('dashboardWidgets.repeatRateTooltip', { rate: Number(value), repeat, total }), '']
  }
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
          <XAxis dataKey="month" {...chartAxis} />
          <YAxis {...chartAxis} tickFormatter={(value) => `${value}%`} />
          <Tooltip {...chartTooltipStyle} formatter={formatEntry} />
          {/* Last month — line only, no fill (DESIGN.md §5.1) */}
          <Area
            type="monotone"
            dataKey="lastMonth"
            name={t('dashboardWidgets.lastMonth')}
            stroke={chartTheme.fg3}
            fill="none"
            strokeWidth={2}
            {...chartAnimation(prefersReducedMotion)}
          />
          {/* This month — filled area + heavier accent line */}
          <Area
            type="monotone"
            dataKey="thisMonth"
            name={t('dashboardWidgets.thisMonth')}
            stroke={chartTheme.accent}
            fill="url(#thisMonthGradient)"
            strokeWidth={2.5}
            {...chartAnimation(prefersReducedMotion)}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export const RepeatCustomerChart = memo(RepeatCustomerChartImpl)
