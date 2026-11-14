import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWorkOrderStore, type WorkOrder } from '../../store/workOrderStore'
import { isCounterSale } from '../../lib/orders/orderOwner'
import { useCustomerStore } from '../../store/customerStore'
import { useCompanyStore } from '../../store/companyStore'
import { useBayStore } from '../../store/bayStore'
import { useAppointmentStore, type Appointment } from '../../store/appointmentStore'
import { useVehicleDirectory } from '../../hooks/useVehicleDirectory'
import { useIsAdmin } from '../../store/authStore'
import { useTranslation } from '../../lib/i18n'
import { formatCurrency } from '../../lib/format/numbers'
import { vehicleLabel, appointmentOwnerName } from '../../lib/format/entities'
import { computePeriodKpis, computeBayCapacity, computeTodaysAppointments } from '../../lib/reports/dashboardMetrics'
import { getPeriodRange, getPreviousPeriodRange } from '../../lib/format/dates'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card'
import { DashboardHero } from './DashboardHero'
import { TodayScheduleRail } from './TodayScheduleRail'
import { OpenOrdersRail } from './OpenOrdersRail'
import { openRecordState } from '../../lib/app/navigation'
import { Button } from '../ui/Button'

/**
 * Dashboard's top section — the hero stat strip and the "right now" pair of
 * widgets (today's schedule, open work orders). The period KPI row that used
 * to sit here moved to Reports > Overview: the dashboard is what the counter
 * glances at during a shift, not where the week is analysed.
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
 */
export function DashboardNowSection({
  endOfToday,
}: {
  /** Computed once in Dashboard.tsx from a single ticker, so every section's
   *  date-range math agrees on the same "today" boundary — see that file's
   *  header for why a per-section useTicker would risk sections disagreeing
   *  at the boundary. */
  endOfToday: Date
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
  const { vehicleById, orderOwnerNameFor } = useVehicleDirectory()

  const { occupiedBays } = useMemo(() => computeBayCapacity(bays), [bays])

  // Deltas are null, not 0, when yesterday had no activity — same
  // convention the P&L report uses (finance.ts's pctDelta). Hero's
  // "Revenue today" stays day-scoped whatever the KPI tab shows.
  const dayKpis = useMemo(
    () => computePeriodKpis(workOrders, customers, getPeriodRange('day', endOfToday), getPreviousPeriodRange('day', endOfToday)),
    [workOrders, customers, endOfToday]
  )
  // All open orders, newest first. The hero counts every one of them; the
  // card previews the first five. The hero used to count the five-item
  // preview, so it never showed more than 5 however many cars were in.
  const openOrders = useMemo(
    () =>
      workOrders
        .filter((wo) => wo.status === 'open')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [workOrders]
  )
  const openOrdersPreview = useMemo(() => openOrders.slice(0, 5), [openOrders])
  const todaysAppointments = useMemo(
    () => computeTodaysAppointments(appointments, endOfToday),
    [appointments, endOfToday]
  )

  const getOrderVehicle = (wo: WorkOrder) =>
    isCounterSale(wo) ? t('workOrders.counterSaleVehicle') : vehicleLabel(vehicleById.get(wo.vehicleId))
  const getAppointmentVehicle = (a: Appointment) =>
    a.vehicleId ? vehicleLabel(vehicleById.get(a.vehicleId)) : t('appointments.noVehicle')
  const getAppointmentOwner = (a: Appointment) => appointmentOwnerName(a, vehicleById, customers, companies)

  return (
    <>
      {/* Status strip — "New order" lives in the topbar (Layout.tsx), not duplicated here */}
      <DashboardHero
        stats={[
          ...(isAdmin ? [{ label: t('dashboard.heroRevenueToday'), value: formatCurrency(dayKpis.revenue) }] : []),
          { label: t('dashboard.heroOpenOrders'), value: openOrders.length.toString() },
          { label: t('dashboard.heroBaysInUse'), value: `${occupiedBays}/${bays.length}` },
        ]}
      />

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
              onViewAll={() => navigate('/schedule?tab=appointments')}
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex items-center justify-between">
            <div>
              <CardTitle>{t('dashboard.openWorkOrders')}</CardTitle>
              <p className="text-caption">{t('dashboard.openWorkOrdersCaption', { count: openOrders.length })}</p>
            </div>
            <Button variant="link" size="sm" onClick={() => navigate('/work-orders')}>
              {t('dashboard.viewAll')}
            </Button>
          </CardHeader>
          <CardContent>
            <OpenOrdersRail
              orders={openOrdersPreview}
              getOwnerName={orderOwnerNameFor}
              getVehicleLabel={getOrderVehicle}
              onSelectOrder={(id) => navigate('/work-orders', { state: openRecordState(id) })}
            />
          </CardContent>
        </Card>
      </div>
    </>
  )
}
