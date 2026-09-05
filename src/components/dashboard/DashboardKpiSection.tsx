import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWorkOrderStore } from '../../store/workOrderStore'
import { useCustomerStore } from '../../store/customerStore'
import { useCompanyStore } from '../../store/companyStore'
import { useBayStore } from '../../store/bayStore'
import { useAppointmentStore, type Appointment } from '../../store/appointmentStore'
import { useVehicleDirectory } from '../../hooks/useVehicleDirectory'
import { useIsAdmin } from '../../store/authStore'
import { useTranslation } from '../../lib/i18n'
import { formatCurrency } from '../../lib/currency'
import { vehicleLabel, appointmentOwnerName } from '../../lib/entities'
import { computePeriodKpis, computeBayCapacity, computeTodaysAppointments } from '../../lib/dashboardMetrics'
import { getPeriodRange, getPreviousPeriodRange, type Period } from '../../lib/dates'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card'
import { DashboardHero } from './DashboardHero'
import { KpiRow } from './KpiRow'
import { TodayScheduleRail } from './TodayScheduleRail'
import { OpenOrdersRail } from './OpenOrdersRail'

/**
 * Dashboard's top section — hero stat strip, the KPI period selector, and
 * the "right now" pair of widgets (today's schedule, open work orders).
 *
 * Split out of src/pages/Dashboard.tsx (an /improve-codebase-architecture
 * pass — see that file's header for why: it was a composition root holding
 * ~30 memo wirings and ~15 component-prop-mappings in one function scope,
 * not because any one calculation was complex — every calculation here was
 * already a pure src/lib/ function). This section calls its own store hooks
 * rather than receiving raw data as props, so it reads as a self-contained
 * page fragment — the only things it takes from its parent are the values
 * that genuinely have to agree across sections (see below).
 *
 * `bays`/`computeBayCapacity` is intentionally duplicated here and in
 * DashboardBaySection — the hero's "bays in use" stat and that section's own
 * gauge card both need it, and recomputing a cheap O(bays) pure function
 * twice is a better trade than threading it through a prop just to avoid
 * that.
 */
export function DashboardKpiSection({
  endOfToday,
  period,
  onPeriodChange,
}: {
  /** Computed once in Dashboard.tsx from a single ticker, so every section's
   *  date-range math agrees on the same "today" boundary — see that file's
   *  header for why a per-section useTicker would risk sections disagreeing
   *  at the boundary. */
  endOfToday: Date
  /** Shared with DashboardBaySection (its service-mix card reads the same
   *  period) — the one piece of UI state genuinely shared across sections,
   *  so it stays lifted in Dashboard.tsx rather than living here. */
  period: Period
  onPeriodChange: (period: Period) => void
}) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  // Worker mode hides revenue/profit (src/lib/auth/permissions.ts's
  // canSeeCostAndProfit) — only the hero's revenue-today stat needs this.
  const isAdmin = useIsAdmin()
  const workOrders = useWorkOrderStore((s) => s.workOrders)
  const customers = useCustomerStore((s) => s.customers)
  const companies = useCompanyStore((s) => s.companies)
  const appointments = useAppointmentStore((s) => s.appointments)
  const bays = useBayStore((s) => s.bays)
  const { vehicleById, ownerNameFor } = useVehicleDirectory()

  const { occupiedBays } = useMemo(() => computeBayCapacity(bays), [bays])

  // Deltas are null, not 0, when yesterday had no activity — same
  // convention the P&L report uses (finance.ts's pctDelta). Hero's
  // "Revenue today" stays day-scoped whatever the KPI tab shows.
  const dayKpis = useMemo(
    () => computePeriodKpis(workOrders, customers, getPeriodRange('day', endOfToday), getPreviousPeriodRange('day', endOfToday)),
    [workOrders, customers, endOfToday]
  )
  const periodKpis = useMemo(
    () => computePeriodKpis(workOrders, customers, getPeriodRange(period, endOfToday), getPreviousPeriodRange(period, endOfToday)),
    [workOrders, customers, period, endOfToday]
  )
  const openOrders = useMemo(
    () =>
      workOrders
        .filter((wo) => wo.status === 'open')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5),
    [workOrders]
  )
  const todaysAppointments = useMemo(
    () => computeTodaysAppointments(appointments, endOfToday),
    [appointments, endOfToday]
  )

  const getVehicleDisplay = (vehicleId: string) => vehicleLabel(vehicleById.get(vehicleId))
  const getAppointmentVehicle = (a: Appointment) =>
    a.vehicleId ? vehicleLabel(vehicleById.get(a.vehicleId)) : t('appointments.noVehicle')
  const getAppointmentOwner = (a: Appointment) => appointmentOwnerName(a, vehicleById, customers, companies)

  return (
    <>
      {/* Hero header — "New order" lives in the topbar (Layout.tsx), not duplicated here */}
      <DashboardHero
        title={t('dashboard.heroTitle')}
        titleLine2={t('dashboard.heroTitleLine2')}
        description={t('dashboard.heroDescription')}
        stats={[
          ...(isAdmin ? [{ label: t('dashboard.heroRevenueToday'), value: formatCurrency(dayKpis.revenue) }] : []),
          { label: t('dashboard.heroOpenOrders'), value: openOrders.length.toString() },
          { label: t('dashboard.heroBaysInUse'), value: `${occupiedBays}/${bays.length}` },
        ]}
      />

      {/* KPI Row — joins the hero's entrance stagger as its last step, sharing
          the stat strip's 180ms delay so the two land together. */}
      <div className="animate-hero-reveal" style={{ animationDelay: '180ms' }}>
        <KpiRow isAdmin={isAdmin} period={period} onPeriodChange={onPeriodChange} kpis={periodKpis} />
      </div>

      {/* Right now — the two most actionable widgets, above the charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.todayScheduleTitle')}</CardTitle>
            <p className="text-caption">{t('dashboard.todayScheduleCaption', { count: todaysAppointments.length })}</p>
          </CardHeader>
          <CardContent>
            <TodayScheduleRail
              appointments={todaysAppointments}
              getOwnerLabel={getAppointmentOwner}
              getVehicleLabel={getAppointmentVehicle}
              onViewAll={() => navigate('/appointments')}
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex items-center justify-between">
            <div>
              <CardTitle>{t('dashboard.openWorkOrders')}</CardTitle>
              <p className="text-caption">{t('dashboard.openWorkOrdersCaption', { count: openOrders.length })}</p>
            </div>
            <button onClick={() => navigate('/work-orders')} className="text-sm text-accent hover:opacity-80">
              {t('dashboard.viewAll')}
            </button>
          </CardHeader>
          <CardContent>
            <OpenOrdersRail
              orders={openOrders}
              getOwnerName={ownerNameFor}
              getVehicleLabel={getVehicleDisplay}
              onSelectOrder={(id) => navigate('/work-orders', { state: { editingId: id } })}
            />
          </CardContent>
        </Card>
      </div>
    </>
  )
}
