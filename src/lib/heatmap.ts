// Generic GitHub-contributions-style calendar grid builder. Entity-agnostic —
// takes pre-aggregated daily counts, not raw events, so callers control what
// "count" means (distinct customers, visits, etc.) before this ever sees it.
import { dayKeyLocal } from './dates'

export interface HeatmapDay {
  date: string
  count: number
  level: 0 | 1 | 2 | 3 | 4
}

export interface HeatmapWeek {
  /** 7 entries, Sunday-first; null = outside the requested range (padding). */
  days: (HeatmapDay | null)[]
}

export interface HeatmapMonthLabel {
  weekIndex: number
  label: string
}

export interface HeatmapGrid {
  weeks: HeatmapWeek[]
  monthLabels: HeatmapMonthLabel[]
  totalCount: number
}

const MS_PER_DAY = 86_400_000

function levelFor(count: number): HeatmapDay['level'] {
  if (count <= 0) return 0
  if (count <= 2) return 1
  if (count <= 4) return 2
  if (count <= 7) return 3
  return 4
}

/**
 * Builds a GitHub-contributions-style grid for one calendar year: weeks as
 * columns (Sunday-first), always spanning the full Jan-Dec shape. Every day
 * within the year — past or future — is a real cell (zero-count/level-0
 * when there's no data); only days outside the year (alignment padding
 * before Jan 1 / after Dec 31) are `null`.
 */
export function buildHeatmapGrid(
  dailyCounts: { date: string; count: number }[],
  year: number
): HeatmapGrid {
  const countByDate = new Map(dailyCounts.map(d => [d.date, d.count]))
  const yearStart = new Date(year, 0, 1)
  const yearEnd = new Date(year, 11, 31)

  const gridStart = new Date(yearStart)
  gridStart.setDate(gridStart.getDate() - gridStart.getDay()) // roll back to the preceding Sunday
  const gridEnd = new Date(yearEnd)
  gridEnd.setDate(gridEnd.getDate() + (6 - gridEnd.getDay())) // roll forward to the following Saturday

  const totalDays = Math.round((gridEnd.getTime() - gridStart.getTime()) / MS_PER_DAY) + 1
  const totalWeeks = Math.ceil(totalDays / 7)

  const weeks: HeatmapWeek[] = []
  const monthLabels: HeatmapMonthLabel[] = []
  let totalCount = 0
  let lastMonth = -1
  const cursor = new Date(gridStart)

  for (let weekIndex = 0; weekIndex < totalWeeks; weekIndex++) {
    const days: (HeatmapDay | null)[] = []
    for (let d = 0; d < 7; d++) {
      if (cursor < yearStart || cursor > yearEnd) {
        days.push(null)
      } else {
        const date = dayKeyLocal(cursor)
        const count = countByDate.get(date) ?? 0
        totalCount += count
        days.push({ date, count, level: levelFor(count) })
        if (cursor.getMonth() !== lastMonth) {
          monthLabels.push({ weekIndex, label: cursor.toLocaleDateString('en-US', { month: 'short' }) })
          lastMonth = cursor.getMonth()
        }
      }
      cursor.setDate(cursor.getDate() + 1)
    }
    weeks.push({ days })
  }

  return { weeks, monthLabels, totalCount }
}
