import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWorkOrderStore } from '../store/workOrderStore'
import { useCustomerStore } from '../store/customerStore'
import { useCompanyStore } from '../store/companyStore'
import { useVehicleStore, Vehicle } from '../store/vehicleStore'
import { useVehicleDirectory } from '../hooks/useVehicleDirectory'
import { useScheduleRuleStore } from '../store/scheduleRuleStore'
import { useServiceItemTypeStore } from '../store/serviceItemTypeStore'
import { useReminderFollowUpStore } from '../store/reminderFollowUpStore'
import { useProductStock } from '../hooks/useProductStock'
import { useTicker } from '../hooks/useTicker'
import { useBayStore } from '../store/bayStore'
import { useAppointmentStore, type Appointment } from '../store/appointmentStore'
import { useWorkerStore } from '../store/workerStore'
import { formatCurrency } from '../lib/currency'
import { isLowStock } from '../lib/stockLedger'
import { vehicleLabel, ownerName, appointmentOwnerName, itemTypeNameLookup } from '../lib/entities'
import { getVehicleReminders } from '../lib/reminders'
import { computeDailyCustomerCounts, filterCompletedOrders, orderDate } from '../lib/finance'
import { Period, getPeriodRange, getPreviousPeriodRange, formatWeekdayShort, type DateLocale } from '../lib/dates'
import { describeMinutesRemaining } from '../lib/duration'
import {
  computePeriodKpis,
  computeBayCapacity,
  buildBayStatusBoard,
  buildTechnicianQueue,
  computeServiceMix,
  computeThroughput,
  computeRepeatCustomerBuckets,
  computeAppointmentTrend,
  computeTodaysAppointments,
} from '../lib/dashboardMetrics'
import { buildHeatmapGrid } from '../lib/heatmap'
import { useTranslation } from '../lib/i18n'
import { useIsAdmin } from '../store/authStore'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card'
import { Select } from '../components/ui/Input'
import { KpiRow } from '../components/dashboard/KpiRow'
import { OpenOrdersRail } from '../components/dashboard/OpenOrdersRail'
import { TodayScheduleRail } from '../components/dashboard/TodayScheduleRail'
import { BayCapacityGauge } from '../components/dashboard/BayCapacityGauge'
import { BayStatusBoard } from '../components/dashboard/BayStatusBoard'
import { ServiceMixTable } from '../components/dashboard/ServiceMixTable'
import { BayThroughputChart } from '../components/dashboard/BayThroughputChart'
import { LowStockRail } from '../components/dashboard/LowStockRail'
import { ServiceRemindersRail } from '../components/dashboard/ServiceRemindersRail'
import { RepeatCustomerChart } from '../components/dashboard/RepeatCustomerChart'
import { AppointmentTrendChart } from '../components/dashboard/AppointmentTrendChart'
import { TechnicianQueue } from '../components/dashboard/TechnicianQueue'
import { DashboardHero } from '../components/dashboard/DashboardHero'
import { CustomerActivityHeatmap } from '../components/CustomerActivityHeatmap'
import { VehicleServiceHistoryDialog } from '../components/vehicles/VehicleServiceHistoryDialog'

// How often the "now" used for the technician progress bar and time-remaining
// ticks forward. Minutes-granular metric, so a minute is plenty fine — see
// src/lib/dashboardMetrics.ts's buildTechnicianQueue for why `now` has to be
// a parameter (not read internally) for this to actually advance the memo.
const CLOCK_TICK_MS = 60_000

/** A technician queue row's raw minutesRemaining, as the translated string
 *  the queue actually displays — pulled out of the memo's .map() callback it
 *  used to sit nested inside. */
function formatMinutesRemaining(minutesRemaining: number, t: (key: string, vars?: Record<string, string | number>) => string): string {
  const display = describeMinutesRemaining(minutesRemaining)
  if (display.kind === 'overdue') return t('dashboard.overdue')
  if (display.kind === 'minutes') return t('dashboard.minutesShort', { m: display.minutes })
  return t('dashboard.hoursMinutesShort', { h: display.hours, m: display.minutes })
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { t, language } = useTranslation()
  const dateLocale: DateLocale = language === 'id' ? 'id-ID' : 'en-US'
  // Worker mode hides revenue/profit (src/lib/auth/permissions.ts's
  // canSeeCostAndProfit) — everything else on this page is counts and
  // percentages, not money, so only the two revenue tiles below need it.
  const isAdmin = useIsAdmin()
  const workOrders = useWorkOrderStore(s => s.workOrders)
  const customers = useCustomerStore(s => s.customers)
  const companies = useCompanyStore(s => s.companies)
  const vehicles = useVehicleStore(s => s.vehicles)
  // Only for ownerNameFor here — this page still needs the raw `vehicles`
  // array above (getVehicleReminders, the activity heatmap) and its own
  // vehicleById memo below (bayLookups), so useVehicleDirectory isn't a full
  // replacement the way it is in WorkOrderList.tsx. Also still reads
  // customers/companies directly, for getAppointmentOwner's customerId/
  // companyId fallback (a walk-in with no vehicle on file yet) — a case
  // ownerNameFor doesn't cover.
  const { ownerNameFor } = useVehicleDirectory()
  const scheduleRules = useScheduleRuleStore(s => s.scheduleRules)
  const reminderFollowUps = useReminderFollowUpStore(s => s.followUps)
  const serviceItemTypes = useServiceItemTypeStore(s => s.serviceItemTypes)
  const products = useProductStock()
  const bays = useBayStore(s => s.bays)
  const appointments = useAppointmentStore(s => s.appointments)
  const workers = useWorkerStore(s => s.workers)
  const itemTypeName = itemTypeNameLookup(serviceItemTypes)

  // Drives the service-history popup a reminders-card row opens on click — see
  // Vehicles.tsx's identical historyVehicle/VehicleServiceHistoryDialog pairing.
  const [historyVehicle, setHistoryVehicle] = useState<Vehicle | null>(null)

  const now = useTicker(CLOCK_TICK_MS)

  // `now` ticks every minute for the technician progress bar only. Everything
  // else on this page is day-or-coarser, so key it on a day stamp instead —
  // the metric memos and their child charts then recompute at most once a day,
  // not 60 times an hour. End-of-today (not midnight): getPeriodRange yields
  // [start, now), so a midnight "now" would make the 'day' range empty.
  const dayStamp = now.toDateString()
  const endOfToday = useMemo(() => {
    const d = new Date(dayStamp)
    d.setHours(23, 59, 59, 999)
    return d
  }, [dayStamp])
  const [period, setPeriod] = useState<Period>('day')

  const lowStockProducts = useMemo(() => products.filter(isLowStock), [products])
  // O(vehicles × rules) and a fresh array identity every render otherwise —
  // which re-rendered ServiceRemindersRail on every unrelated Dashboard tick.
  const vehicleReminders = useMemo(
    () => getVehicleReminders(vehicles, scheduleRules, endOfToday, reminderFollowUps),
    [vehicles, scheduleRules, endOfToday, reminderFollowUps],
  )

  // Lookup maps, built once per store change, so the derivations below do O(1)
  // key lookups instead of repeated O(n) .find() scans over the arrays.
  const vehicleById = useMemo(() => new Map(vehicles.map(v => [v.id, v])), [vehicles])
  const workerById = useMemo(() => new Map(workers.map(w => [w.id, w])), [workers])
  const workOrderById = useMemo(() => new Map(workOrders.map(wo => [wo.id, wo])), [workOrders])
  const bayLookups = useMemo(
    () => ({
      workOrderById,
      vehicleLabelOf: (vehicleId: string) => {
        const v = vehicleById.get(vehicleId)
        return v ? vehicleLabel(v) : undefined
      },
      workerById,
    }),
    [workOrderById, vehicleById, workerById]
  )

  // Today's KPIs derived from completed orders (src/lib/dashboardMetrics.ts) —
  // deltas are null, not 0, when yesterday had no activity, same convention
  // the P&L report uses (finance.ts's pctDelta).
  // Hero's "Revenue today" stat stays day-scoped whatever the KPI tab shows.
  const dayKpis = useMemo(
    () => computePeriodKpis(workOrders, customers, getPeriodRange('day', endOfToday), getPreviousPeriodRange('day', endOfToday)),
    [workOrders, customers, endOfToday],
  )
  const periodKpis = useMemo(
    () => computePeriodKpis(workOrders, customers, getPeriodRange(period, endOfToday), getPreviousPeriodRange(period, endOfToday)),
    [workOrders, customers, period, endOfToday],
  )

  const [heatmapYear, setHeatmapYear] = useState(() => new Date().getFullYear())
  // Completed-only — shared by availableYears and the heatmap grid below.
  // Passing all workOrders (including open/cancelled) to the grid used to
  // disagree with Reports.tsx's own heatmap, which was completed-only from
  // the start; this is now the one definition both pages share.
  const completedForHeatmap = useMemo(() => workOrders.filter(wo => wo.status === 'completed'), [workOrders])
  const availableYears = useMemo(
    () => [...new Set([
      new Date().getFullYear(),
      ...completedForHeatmap.map(wo => orderDate(wo).getFullYear()),
    ])].sort((a, b) => b - a),
    [completedForHeatmap]
  )
  const customerActivityGrid = useMemo(
    () => buildHeatmapGrid(computeDailyCustomerCounts(completedForHeatmap, vehicles), heatmapYear),
    [completedForHeatmap, vehicles, heatmapYear]
  )

  // Bay capacity
  const { occupiedBays, bayCapacityPct } = useMemo(() => computeBayCapacity(bays), [bays])

  // Bay status for mini board
  const bayStatusData = useMemo(() => buildBayStatusBoard(bays, bayLookups), [bays, bayLookups])

  // Service mix (top services by frequency)
  const serviceMix = useMemo(
    () => computeServiceMix(filterCompletedOrders(workOrders, getPeriodRange(period, endOfToday))),
    [workOrders, period, endOfToday],
  )

  // Chart data derived from the stores — no fabricated numbers.
  // Trailing 7 days of appointments, split scheduled vs walk-in.
  const throughputData = useMemo(
    () =>
      computeThroughput(appointments, endOfToday).map(d => ({
        day: formatWeekdayShort(d.date, dateLocale),
        scheduled: d.scheduled,
        walkIn: d.walkIn,
      })),
    [appointments, endOfToday, dateLocale]
  )

  // Repeat-customer RATE per week-of-month: repeat orders / all completed
  // orders that week. The chart's axis is a percentage, so feed it one.
  const repeatData = useMemo(() => {
    const buckets = computeRepeatCustomerBuckets(workOrders, endOfToday)
    const rate = (r: number, total: number) => (total > 0 ? Math.round((r / total) * 100) : 0)
    return [0, 1, 2, 3].map(i => ({
      month: t('dashboard.weekN', { n: i + 1 }),
      lastMonth: rate(buckets.lastMonth[i], buckets.lastMonthTotal[i]),
      thisMonth: rate(buckets.thisMonth[i], buckets.thisMonthTotal[i]),
      lastMonthRepeat: buckets.lastMonth[i],
      lastMonthTotal: buckets.lastMonthTotal[i],
      thisMonthRepeat: buckets.thisMonth[i],
      thisMonthTotal: buckets.thisMonthTotal[i],
    }))
  }, [workOrders, endOfToday, t])

  const monthKeys = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const months = useMemo(() => monthKeys.map(k => t(`dashboard.month${k}`)), [t]) // eslint-disable-line react-hooks/exhaustive-deps
  const currentMonthName = months[endOfToday.getMonth()]
  // Appointments per month, current year.
  const appointmentTrendData = useMemo(
    () => computeAppointmentTrend(appointments, endOfToday).map(({ monthIndex, appointments }) => ({ month: months[monthIndex], appointments })),
    [appointments, endOfToday, months]
  )

  // Technician queue data - who's on which bay, with raw minutes/progress
  // formatted into translated strings here (src/lib/dashboardMetrics.ts keeps
  // numbers only, so it stays testable without i18n).
  const technicianQueueData = useMemo(
    () =>
      buildTechnicianQueue(workers, bays, bayLookups, now).map(row => ({
        id: row.id,
        name: row.name,
        status: row.status,
        bayName: row.bayName,
        vehicleInfo: row.vehicleInfo,
        timeRemaining: row.minutesRemaining != null ? formatMinutesRemaining(row.minutesRemaining, t) : undefined,
        progress: row.progressPct ?? undefined,
      })),
    [workers, bays, bayLookups, now, t]
  )

  // Open work orders
  const openOrders = useMemo(() => workOrders.filter(wo => wo.status === 'open')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5), [workOrders])

  const todaysAppointments = useMemo(
    () => computeTodaysAppointments(appointments, endOfToday),
    [appointments, endOfToday],
  )

  const getVehicleDisplay = (vehicleId: string) => vehicleLabel(vehicleById.get(vehicleId))
  const getAppointmentVehicle = (a: Appointment) =>
    a.vehicleId ? vehicleLabel(vehicleById.get(a.vehicleId)) : t('appointments.noVehicle')
  const getAppointmentOwner = (a: Appointment) => appointmentOwnerName(a, vehicleById, customers, companies)

  return (
    <div>
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
        <KpiRow isAdmin={isAdmin} period={period} onPeriodChange={setPeriod} kpis={periodKpis} />
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

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Bay Capacity Gauge */}
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.bayCapacity')}</CardTitle>
          </CardHeader>
          <CardContent>
            <BayCapacityGauge percentage={bayCapacityPct} />
            <p className="text-center text-caption mt-2">
              {t('dashboard.bayCapacityOf', { occupied: occupiedBays, total: bays.length })}
            </p>
          </CardContent>
        </Card>

        {/* Bay Status Mini Board */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex items-center justify-between">
            <CardTitle>{t('dashboard.bayStatus')}</CardTitle>
            <button
              onClick={() => navigate('/bays')}
              className="text-sm text-accent hover:opacity-80"
            >
              {t('dashboard.viewAll')}
            </button>
          </CardHeader>
          <CardContent>
            <BayStatusBoard bays={bayStatusData} compact onSelectBay={() => navigate('/bays')} />
          </CardContent>
        </Card>
      </div>

      {/* Technician Queue + Service Mix Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Technician Assignment Queue */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <div>
              <CardTitle>{t('dashboard.technicianQueue')}</CardTitle>
              <p className="text-caption">{t('dashboard.technicianQueueCaption')}</p>
            </div>
            {isAdmin && (
              <button
                onClick={() => navigate('/technicians')}
                className="text-sm text-accent hover:opacity-80"
              >
                {t('dashboard.viewAll')}
              </button>
            )}
          </CardHeader>
          <CardContent>
            <TechnicianQueue technicians={technicianQueueData} />
          </CardContent>
        </Card>

        {/* Service Mix */}
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.serviceMix')}</CardTitle>
            <p className="text-caption">{t('dashboard.serviceMixCaption')}</p>
          </CardHeader>
          <CardContent>
            <ServiceMixTable services={serviceMix} />
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{t('dashboard.bayThroughput')}</CardTitle>
          <p className="text-caption">{t('dashboard.bayThroughputCaption')}</p>
        </CardHeader>
        <CardContent>
          <BayThroughputChart data={throughputData} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Low Stock */}
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.lowStockAlert')}</CardTitle>
            <p className="text-caption">{t('dashboard.lowStockCaption', { count: lowStockProducts.length })}</p>
          </CardHeader>
          <CardContent>
            <LowStockRail
              items={lowStockProducts}
              onViewAll={() => navigate('/inventory')}
            />
          </CardContent>
        </Card>

        {/* Repeat Customer Rate */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t('dashboard.repeatCustomerRate')}</CardTitle>
            <p className="text-caption">{t('dashboard.repeatCustomerCaption')}</p>
          </CardHeader>
          <CardContent>
            <RepeatCustomerChart data={repeatData} />
          </CardContent>
        </Card>
      </div>

      {/* Service Reminders */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{t('dashboard.remindersTitle')}</CardTitle>
          <p className="text-caption">{t('dashboard.remindersCaption', { count: vehicleReminders.length })}</p>
        </CardHeader>
        <CardContent>
          <ServiceRemindersRail
            reminders={vehicleReminders}
            getOwnerName={(vehicle) => ownerName(vehicle, customers, companies)}
            itemTypeName={itemTypeName}
            onSelectVehicle={setHistoryVehicle}
            onViewAll={() => navigate('/reminders')}
          />
        </CardContent>
      </Card>

      {/* Customer Activity Heatmap */}
      <Card className="mb-6">
        <CardHeader className="flex items-center justify-between">
          <div>
            <CardTitle>{t('dashboard.customerActivityHeading')}</CardTitle>
            <p className="text-caption">{t('dashboard.customerActivityCaption', { year: heatmapYear })}</p>
          </div>
          <Select value={heatmapYear} onChange={(e) => setHeatmapYear(Number(e.target.value))} className="w-auto">
            {availableYears.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </Select>
        </CardHeader>
        <CardContent>
          <CustomerActivityHeatmap grid={customerActivityGrid} />
        </CardContent>
      </Card>

      {/* Appointment Trend */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{t('dashboard.appointmentVolumeTrend')}</CardTitle>
          <p className="text-caption">{t('dashboard.appointmentVolumeCaption')}</p>
        </CardHeader>
        <CardContent>
          <AppointmentTrendChart data={appointmentTrendData} currentMonth={currentMonthName} />
        </CardContent>
      </Card>

      {historyVehicle && (
        <VehicleServiceHistoryDialog open vehicle={historyVehicle} onClose={() => setHistoryVehicle(null)} />
      )}
    </div>
  )
}
