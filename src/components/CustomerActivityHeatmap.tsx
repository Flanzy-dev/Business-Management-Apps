import { memo } from 'react'
import { useTranslation } from '../lib/i18n'
import type { HeatmapGrid } from '../lib/heatmap'

const LEVEL_CLASSES: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: 'bg-surface-sunken',
  1: 'bg-accent/25',
  2: 'bg-accent/50',
  3: 'bg-accent/75',
  4: 'bg-accent',
}

/** Formats a 'YYYY-MM-DD' day key as local midnight, avoiding the UTC day-shift
 * pitfall `new Date(str)` has for date-only strings (see expenseDate in finance.ts). */
function formatDayKey(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

interface CustomerActivityHeatmapProps {
  grid: HeatmapGrid
  className?: string
}

function CustomerActivityHeatmapImpl({ grid, className = '' }: CustomerActivityHeatmapProps) {
  const { t, tc } = useTranslation()
  const labelByWeek = new Map(grid.monthLabels.map(m => [m.weekIndex, m.label]))

  return (
    <div className={className}>
      <p className="text-caption mb-3">{t('heatmap.totalSuffix', { count: grid.totalCount })}</p>
      <div className="overflow-x-auto">
        <div className="inline-flex flex-col gap-1">
          <div className="flex gap-1.5">
            {grid.weeks.map((_, i) => (
              <div key={i} className="w-4 text-[10px] text-text-secondary shrink-0">
                {labelByWeek.get(i) ?? ''}
              </div>
            ))}
          </div>
          <div className="flex gap-1.5">
            {grid.weeks.map((week, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                {week.days.map((day, j) => (
                  <div
                    key={j}
                    title={day ? tc('heatmap.tooltip', day.count, { date: formatDayKey(day.date) }) : undefined}
                    className={`w-4 h-4 rounded-[3px] ${day ? LEVEL_CLASSES[day.level] : 'bg-transparent'}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export const CustomerActivityHeatmap = memo(CustomerActivityHeatmapImpl)
