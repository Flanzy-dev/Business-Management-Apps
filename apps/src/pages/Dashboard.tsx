import { useMemo } from 'react'
import { useTicker } from '../hooks/useTicker'
import { DashboardNowSection } from '../components/dashboard/DashboardNowSection'
import { DashboardBaySection } from '../components/dashboard/DashboardBaySection'
import { DashboardAlertsSection } from '../components/dashboard/DashboardAlertsSection'
import { useTranslation } from '../lib/i18n'

// How often `now` ticks forward. Only used to notice the day rolling over
// (endOfToday below), so a minute is plenty fine.
const CLOCK_TICK_MS = 60_000

/**
 * The dashboard: what is happening at the shop today, top to bottom.
 *
 *  1. DashboardNowSection — today's revenue (admin), open orders and bays in
 *     use; today's appointments; the newest open orders.
 *  2. DashboardBaySection — who and what is on each bay.
 *  3. DashboardAlertsSection — products running low; vehicles due for service.
 *
 * It used to carry 13 widgets in 9 rows, with bay capacity shown three times
 * and a week's worth of charts mixed in with what needs doing now. The
 * analysis (period KPIs, service mix, throughput, repeat customers,
 * appointment trend) lives in Reports > Overview.
 *
 * Owns `endOfToday` so every section's date math agrees on the same "today"
 * boundary — a per-section ticker could disagree at the moment the day rolls
 * over.
 */
export default function Dashboard() {
  const { t } = useTranslation()
  const now = useTicker(CLOCK_TICK_MS)

  // Keyed on a day stamp so the sections' memos recompute at most once a day,
  // not every minute. End-of-today (not midnight): getPeriodRange yields
  // [start, now), so a midnight "now" would make the 'day' range empty.
  const dayStamp = now.toDateString()
  const endOfToday = useMemo(() => {
    const d = new Date(dayStamp)
    d.setHours(23, 59, 59, 999)
    return d
  }, [dayStamp])

  return (
    <div>
      {/* The visible title lives in the topbar; this is the page's one <h1> for
          assistive tech (every other page gets it from PageHeader). */}
      <h1 className="sr-only">{t('topbar.dashboard')}</h1>
      <DashboardNowSection endOfToday={endOfToday} />
      <DashboardBaySection />
      <DashboardAlertsSection endOfToday={endOfToday} />
    </div>
  )
}
