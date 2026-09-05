import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBayStore } from '../../store/bayStore'
import { useWorkerStore } from '../../store/workerStore'
import { useWorkOrderStore } from '../../store/workOrderStore'
import { useVehicleStore } from '../../store/vehicleStore'
import { useAppointmentStore } from '../../store/appointmentStore'
import { useIsAdmin } from '../../store/authStore'
import { useTranslation } from '../../lib/i18n'
import { vehicleLabel } from '../../lib/entities'
import { describeMinutesRemaining } from '../../lib/duration'
import { formatWeekdayShort, type DateLocale, type Period } from '../../lib/dates'
import { filterCompletedOrders } from '../../lib/finance'
import {
  computeBayCapacity,
  buildBayStatusBoard,
  buildTechnicianQueue,
  computeServiceMix,
  computeThroughput,
} from '../../lib/dashboardMetrics'
import { getPeriodRange } from '../../lib/dates'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card'
import { BayCapacityGauge } from './BayCapacityGauge'
import { BayStatusBoard } from './BayStatusBoard'
import { TechnicianQueue } from './TechnicianQueue'
import { ServiceMixTable } from './ServiceMixTable'
import { BayThroughputChart } from './BayThroughputChart'

/** A technician queue row's raw minutesRemaining, as the translated string
 *  the queue actually displays — pulled out of the memo's .map() callback it
 *  used to sit nested inside. Moved here with the technician queue itself
 *  when src/pages/Dashboard.tsx was split (see this section's own header). */
function formatMinutesRemaining(
  minutesRemaining: number,
  t: (key: string, vars?: Record<string, string | number>) => string
): string {
  const display = describeMinutesRemaining(minutesRemaining)
  if (display.kind === 'overdue') return t('dashboard.overdue')
  if (display.kind === 'minutes') return t('dashboard.minutesShort', { m: display.minutes })
  return t('dashboard.hoursMinutesShort', { h: display.hours, m: display.minutes })
}

/**
 * Dashboard's bay-operations section — capacity gauge, the mini bay-status
 * board, the technician assignment queue, today's service mix, and the
 * trailing-7-day bay throughput chart.
 *
 * Split out of src/pages/Dashboard.tsx — see DashboardKpiSection's header
 * for the full reasoning (a composition root grown too large in one
 * function, not any one calculation being complex). This section builds its
 * own `vehicleById`/`workerById`/`workOrderById` lookups rather than
 * receiving them from its parent — DashboardKpiSection needs `vehicleById`
 * too (via useVehicleDirectory), but the two consumers want different
 * shapes (that one wants owner-name lookup, this one wants the raw map for
 * `bayLookups`), so each section deriving its own from the same store is
 * simpler than threading one shared derived value down for a single use.
 */
export function DashboardBaySection({
  endOfToday,
  now,
  period,
}: {
  /** Same shared "today" boundary every section uses — see
   *  DashboardKpiSection's header. */
  endOfToday: Date
  /** Only the technician queue's per-row progress bar needs live minutes;
   *  everything else here is day-or-coarser. Ticks once a minute from
   *  Dashboard.tsx's single shared ticker (src/pages/Dashboard.tsx's
   *  CLOCK_TICK_MS) rather than a second one here, so this section's
   *  "now" can never drift from what the rest of the page shows. */
  now: Date
  /** Shared with DashboardKpiSection (its KPI row controls this same
   *  value) — the service-mix card reads it, so it stays lifted in
   *  Dashboard.tsx rather than living here. */
  period: Period
}) {
  const navigate = useNavigate()
  const { t, language } = useTranslation()
  const dateLocale: DateLocale = language === 'id' ? 'id-ID' : 'en-US'
  const isAdmin = useIsAdmin()
  const bays = useBayStore((s) => s.bays)
  const workers = useWorkerStore((s) => s.workers)
  const workOrders = useWorkOrderStore((s) => s.workOrders)
  const vehicles = useVehicleStore((s) => s.vehicles)
  const appointments = useAppointmentStore((s) => s.appointments)

  const { occupiedBays, bayCapacityPct } = useMemo(() => computeBayCapacity(bays), [bays])

  // Lookup maps built once per store change, so buildBayStatusBoard/
  // buildTechnicianQueue do O(1) key lookups instead of repeated O(n)
  // .find() scans over the arrays.
  const vehicleById = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles])
  const workerById = useMemo(() => new Map(workers.map((w) => [w.id, w])), [workers])
  const workOrderById = useMemo(() => new Map(workOrders.map((wo) => [wo.id, wo])), [workOrders])
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

  const bayStatusData = useMemo(() => buildBayStatusBoard(bays, bayLookups), [bays, bayLookups])

  const technicianQueueData = useMemo(
    () =>
      buildTechnicianQueue(workers, bays, bayLookups, now).map((row) => ({
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

  const serviceMix = useMemo(
    () => computeServiceMix(filterCompletedOrders(workOrders, getPeriodRange(period, endOfToday))),
    [workOrders, period, endOfToday]
  )

  // Trailing 7 days of appointments, split scheduled vs walk-in.
  const throughputData = useMemo(
    () =>
      computeThroughput(appointments, endOfToday).map((d) => ({
        day: formatWeekdayShort(d.date, dateLocale),
        scheduled: d.scheduled,
        walkIn: d.walkIn,
      })),
    [appointments, endOfToday, dateLocale]
  )

  return (
    <>
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
            <button onClick={() => navigate('/bays')} className="text-sm text-accent hover:opacity-80">
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
              <button onClick={() => navigate('/technicians')} className="text-sm text-accent hover:opacity-80">
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
    </>
  )
}
