import { useMemo, useState } from 'react'
import { useTicker } from '../hooks/useTicker'
import { type Period } from '../lib/dates'
import { DashboardKpiSection } from '../components/dashboard/DashboardKpiSection'
import { DashboardBaySection } from '../components/dashboard/DashboardBaySection'
import { DashboardTrendsSection } from '../components/dashboard/DashboardTrendsSection'

// How often `now` (the technician progress bar's live minutes remaining,
// inside DashboardBaySection) ticks forward. Minutes-granular metric, so a
// minute is plenty fine — see src/lib/dashboardMetrics.ts's
// buildTechnicianQueue for why `now` has to be a parameter (not read
// internally) for this to actually advance the memo.
const CLOCK_TICK_MS = 60_000

/**
 * The dashboard page — a thin composition root over three sections
 * (DashboardKpiSection, DashboardBaySection, DashboardTrendsSection), split
 * out via an /improve-codebase-architecture pass. Before the split, every
 * calculation on this page was ALREADY a pure function imported from
 * src/lib/ and every widget was ALREADY its own presentational component —
 * the actual friction fallow's static analysis flagged (cognitive
 * complexity 45, 41 imports) was this file's role as a composition root
 * holding ~30 `useMemo` wirings and ~15 component-prop-mappings in one
 * function scope, independent of any single piece being complex.
 *
 * Each section now calls its own store hooks directly rather than receiving
 * raw data as props — the idiomatic pattern the rest of this codebase
 * already uses — so this file owns exactly the two things that genuinely
 * have to agree ACROSS sections:
 *
 *  - `endOfToday`: every section's date-range math needs the same "today"
 *    boundary. A per-section useTicker/useMemo would risk two sections
 *    disagreeing at the exact moment the day rolls over — a single shared
 *    computation here is what rules that out.
 *  - `period`: DashboardKpiSection's KPI-row control and
 *    DashboardBaySection's service-mix card both read the same value, so it
 *    stays lifted here rather than living in either section.
 *
 * Everything else (heatmapYear, historyVehicle, isAdmin, t, navigate, every
 * raw store read) is now local to whichever section actually uses it — see
 * each section's own header for why.
 */
export default function Dashboard() {
  const now = useTicker(CLOCK_TICK_MS)

  // `now` ticks every minute; everything else on this page is day-or-coarser,
  // so key it on a day stamp instead — the metric memos and their child
  // charts then recompute at most once a day, not 60 times an hour.
  // End-of-today (not midnight): getPeriodRange yields [start, now), so a
  // midnight "now" would make the 'day' range empty.
  const dayStamp = now.toDateString()
  const endOfToday = useMemo(() => {
    const d = new Date(dayStamp)
    d.setHours(23, 59, 59, 999)
    return d
  }, [dayStamp])
  const [period, setPeriod] = useState<Period>('day')

  return (
    <div>
      <DashboardKpiSection endOfToday={endOfToday} period={period} onPeriodChange={setPeriod} />
      <DashboardBaySection endOfToday={endOfToday} now={now} period={period} />
      <DashboardTrendsSection endOfToday={endOfToday} />
    </div>
  )
}
