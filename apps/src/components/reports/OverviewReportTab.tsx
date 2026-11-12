import { useMemo } from 'react'
import { useWorkOrderStore } from '../../store/workOrderStore'
import { useCustomerStore } from '../../store/customerStore'
import { useAppointmentStore } from '../../store/appointmentStore'
import { useTranslation } from '../../lib/i18n'
import { endOfDay, formatWeekdayShort, getPeriodRange, getPreviousPeriodRange, type DateLocale, type Period } from '../../lib/format/dates'
import { filterCompletedOrders } from '../../lib/reports/finance'
import {
  computePeriodKpis,
  computeServiceMix,
  computeThroughput,
  computeRepeatCustomerBuckets,
  computeAppointmentTrend,
} from '../../lib/reports/dashboardMetrics'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card'
import { KpiRow } from '../dashboard/KpiRow'
import { ServiceMixTable } from '../dashboard/ServiceMixTable'
import { BayThroughputChart } from '../dashboard/BayThroughputChart'
import { RepeatCustomerChart } from '../dashboard/RepeatCustomerChart'
import { AppointmentTrendChart } from '../dashboard/AppointmentTrendChart'

const MONTH_KEYS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * Reports > Overview: how the shop is doing over a period. These widgets used
 * to sit on the Dashboard, mixed in with what needs doing right now; the
 * Dashboard now shows only today, and the analysis lives here with the rest
 * of the reports. Admin-only like every Reports tab, so the Revenue KPI is
 * always shown. The customer-activity heatmap is on the Customers tab.
 */
export function OverviewReportTab({ period, onPeriodChange }: { period: Period; onPeriodChange: (period: Period) => void }) {
  const { t, language } = useTranslation()
  const dateLocale: DateLocale = language === 'id' ? 'id-ID' : 'en-US'
  const workOrders = useWorkOrderStore((s) => s.workOrders)
  const customers = useCustomerStore((s) => s.customers)
  const appointments = useAppointmentStore((s) => s.appointments)

  // End of today, not "now": getPeriodRange yields [start, end), so a
  // mid-day end would drop the rest of today's orders from the 'day' range.
  const endOfToday = useMemo(() => endOfDay(), [])

  const kpis = useMemo(
    () => computePeriodKpis(workOrders, customers, getPeriodRange(period, endOfToday), getPreviousPeriodRange(period, endOfToday)),
    [workOrders, customers, period, endOfToday]
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

  // Repeat-customer RATE per week-of-month: repeat orders / all completed
  // orders that week. The chart's axis is a percentage, so feed it one.
  const repeatData = useMemo(() => {
    const buckets = computeRepeatCustomerBuckets(workOrders, endOfToday)
    const rate = (r: number, total: number) => (total > 0 ? Math.round((r / total) * 100) : 0)
    return [0, 1, 2, 3].map((i) => ({
      month: t('dashboard.weekN', { n: i + 1 }),
      lastMonth: rate(buckets.lastMonth[i], buckets.lastMonthTotal[i]),
      thisMonth: rate(buckets.thisMonth[i], buckets.thisMonthTotal[i]),
      lastMonthRepeat: buckets.lastMonth[i],
      lastMonthTotal: buckets.lastMonthTotal[i],
      thisMonthRepeat: buckets.thisMonth[i],
      thisMonthTotal: buckets.thisMonthTotal[i],
    }))
  }, [workOrders, endOfToday, t])

  const months = useMemo(() => MONTH_KEYS.map((k) => t(`dashboard.month${k}`)), [t])
  const appointmentTrendData = useMemo(
    () =>
      computeAppointmentTrend(appointments, endOfToday).map(({ monthIndex, appointments }) => ({
        month: months[monthIndex],
        appointments,
      })),
    [appointments, endOfToday, months]
  )

  return (
    <>
      <KpiRow isAdmin period={period} onPeriodChange={onPeriodChange} kpis={kpis} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.serviceMix')}</CardTitle>
            <p className="text-caption">{t('dashboard.serviceMixCaption')}</p>
          </CardHeader>
          <CardContent>
            <ServiceMixTable services={serviceMix} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.repeatCustomerRate')}</CardTitle>
            <p className="text-caption">{t('dashboard.repeatCustomerCaption')}</p>
          </CardHeader>
          <CardContent>
            <RepeatCustomerChart data={repeatData} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.bayThroughput')}</CardTitle>
            <p className="text-caption">{t('dashboard.bayThroughputCaption')}</p>
          </CardHeader>
          <CardContent>
            <BayThroughputChart data={throughputData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.appointmentVolumeTrend')}</CardTitle>
            <p className="text-caption">{t('dashboard.appointmentVolumeCaption')}</p>
          </CardHeader>
          <CardContent>
            <AppointmentTrendChart data={appointmentTrendData} currentMonth={months[endOfToday.getMonth()]} />
          </CardContent>
        </Card>
      </div>
    </>
  )
}
