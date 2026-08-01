import { describe, it, expect } from 'vitest'
import { buildHeatmapGrid } from '../heatmap'

describe('buildHeatmapGrid', () => {
  it('shows the full year, Jan 1 - Dec 31, all real (no clipping)', () => {
    const grid = buildHeatmapGrid([], 2025)
    const realDates = grid.weeks
      .flatMap(w => w.days)
      .filter((d): d is NonNullable<typeof d> => d !== null)
      .map(d => d.date)
    expect(realDates[0]).toBe('2025-01-01')
    expect(realDates[realDates.length - 1]).toBe('2025-12-31')
    expect(realDates).toHaveLength(365)
  })

  it('shows a year still in progress in full, including future dates as zero-count real cells', () => {
    const grid = buildHeatmapGrid([], 2026)
    const realDates = grid.weeks
      .flatMap(w => w.days)
      .filter((d): d is NonNullable<typeof d> => d !== null)
      .map(d => d.date)
    expect(realDates[0]).toBe('2026-01-01')
    expect(realDates[realDates.length - 1]).toBe('2026-12-31')
    // Far-future dates (relative to whenever this test runs) are present, not null.
    const dec31 = grid.weeks.flatMap(w => w.days).find(d => d?.date === '2026-12-31')
    expect(dec31).toEqual({ date: '2026-12-31', count: 0, level: 0 })
  })

  it('starts every week on a Sunday', () => {
    const grid = buildHeatmapGrid([], 2025)
    for (const week of grid.weeks) {
      for (let i = 0; i < 7; i++) {
        const day = week.days[i]
        if (!day) continue
        const [y, m, d] = day.date.split('-').map(Number)
        expect(new Date(y, m - 1, d).getDay()).toBe(i)
      }
    }
  })

  it('buckets counts into levels: 0, 1-2, 3-4, 5-7, 8+', () => {
    const grid = buildHeatmapGrid(
      [
        { date: '2025-06-02', count: 1 },
        { date: '2025-06-03', count: 2 },
        { date: '2025-06-04', count: 3 },
        { date: '2025-06-05', count: 4 },
        { date: '2025-06-08', count: 5 },
        { date: '2025-06-09', count: 7 },
        { date: '2025-06-10', count: 8 },
      ],
      2025
    )
    const byDate = new Map(
      grid.weeks.flatMap(w => w.days).filter((d): d is NonNullable<typeof d> => d !== null).map(d => [d.date, d])
    )
    expect(byDate.get('2025-06-02')!.level).toBe(1)
    expect(byDate.get('2025-06-03')!.level).toBe(1)
    expect(byDate.get('2025-06-04')!.level).toBe(2)
    expect(byDate.get('2025-06-05')!.level).toBe(2)
    expect(byDate.get('2025-06-08')!.level).toBe(3)
    expect(byDate.get('2025-06-09')!.level).toBe(3)
    expect(byDate.get('2025-06-10')!.level).toBe(4)
  })

  it('places month labels across the full year, in order, starting at week 0', () => {
    const grid = buildHeatmapGrid([], 2025)
    expect(grid.monthLabels[0].weekIndex).toBe(0)
    expect(grid.monthLabels.map(m => m.label)).toEqual([
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ])
    for (let i = 1; i < grid.monthLabels.length; i++) {
      expect(grid.monthLabels[i].weekIndex).toBeGreaterThanOrEqual(grid.monthLabels[i - 1].weekIndex)
    }
  })

  it('returns an all-zero grid and zero total for empty input', () => {
    const grid = buildHeatmapGrid([], 2025)
    expect(grid.totalCount).toBe(0)
    for (const week of grid.weeks) {
      for (const day of week.days) {
        if (day) expect(day.count).toBe(0)
      }
    }
  })

  it('sums only in-range counts, ignoring dates from other years in the input', () => {
    const grid = buildHeatmapGrid(
      [
        { date: '2025-03-01', count: 3 },
        { date: '2025-03-02', count: 2 },
        { date: '2024-12-31', count: 100 }, // previous year — must be ignored
        { date: '2026-01-01', count: 100 }, // next year — must be ignored
      ],
      2025
    )
    expect(grid.totalCount).toBe(5)
  })
})
