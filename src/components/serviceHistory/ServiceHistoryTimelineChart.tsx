import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { TooltipContentProps } from 'recharts'
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent'
import { chartTheme } from '../../lib/chartTheme'
import { formatCurrency } from '../../lib/currency'
import { formatDistance } from '../../lib/units'
import { formatDate } from '../../lib/dates'
import { useTranslation } from '../../lib/i18n'

export interface ServiceHistoryTimelinePoint {
  id: string
  index: number
  date: string
  orderNumber: number
  total: number
  odometer: number | null
  workerName: string
  items: { description: string; quantity: number; tag: string | null }[]
}

function ServiceEventTooltipContent({ active, payload }: TooltipContentProps<ValueType, NameType>) {
  const { t } = useTranslation()
  if (!active || !payload?.length) return null
  const point = payload[0].payload as ServiceHistoryTimelinePoint
  return (
    <div
      className="rounded-radius-sm p-3 max-w-xs"
      style={{ backgroundColor: chartTheme.bg2, border: `1px solid ${chartTheme.border2}`, color: chartTheme.fg1 }}
    >
      <div className="flex items-center justify-between gap-4 mb-1">
        <span className="font-mono text-sm">#{point.orderNumber}</span>
        <span className="text-xs tabular-nums" style={{ color: chartTheme.fg3 }}>{formatDate(point.date)}</span>
      </div>
      <div className="font-medium tabular-nums mb-2">{formatCurrency(point.total)}</div>
      <div className="space-y-0.5 mb-2">
        {point.items.map((item, i) => (
          <div key={i} className="text-xs" style={{ color: chartTheme.fg3 }}>
            {item.description} <span>x{item.quantity}</span>
            {item.tag && <span style={{ color: chartTheme.accent }} className="text-2xs uppercase tracking-wide ml-1">{item.tag}</span>}
          </div>
        ))}
      </div>
      <div
        className="flex items-center gap-3 text-2xs pt-2 border-t"
        style={{ color: chartTheme.fg3, borderColor: chartTheme.border2 }}
      >
        <span>{t('serviceHistory.mileageField')} {point.odometer != null ? formatDistance(point.odometer) : '-'}</span>
        <span>{t('serviceHistory.techField')} {point.workerName}</span>
      </div>
    </div>
  )
}

interface ServiceHistoryTimelineChartProps {
  data: ServiceHistoryTimelinePoint[]
  className?: string
}

export function ServiceHistoryTimelineChart({ data, className = '' }: ServiceHistoryTimelineChartProps) {
  const plotted = data.map((d) => ({ ...d, y: 0.5 }))
  const xDomain: [number, number] = data.length <= 1 ? [-0.5, 0.5] : [0, data.length - 1]

  return (
    <div className={`h-32 ${className}`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={plotted} margin={{ top: 16, right: 16, left: 16, bottom: 8 }}>
          <XAxis
            dataKey="index"
            type="number"
            domain={xDomain}
            ticks={data.map((d) => d.index)}
            tickFormatter={(i: number) => formatDate(data[i]?.date ?? '')}
            interval="preserveStartEnd"
            axisLine={false}
            tickLine={false}
            tick={{ fill: chartTheme.fg3, fontSize: 11 }}
          />
          <YAxis dataKey="y" domain={[0, 1]} hide />
          <Tooltip
            cursor={{ stroke: chartTheme.border3, strokeDasharray: '3 3' }}
            content={ServiceEventTooltipContent}
          />
          <Line
            type="linear"
            dataKey="y"
            stroke={chartTheme.border2}
            strokeWidth={1.5}
            dot={{ r: 5, fill: chartTheme.accent, stroke: chartTheme.bg2, strokeWidth: 2 }}
            activeDot={{ r: 7, fill: chartTheme.accent, stroke: chartTheme.bg2, strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
