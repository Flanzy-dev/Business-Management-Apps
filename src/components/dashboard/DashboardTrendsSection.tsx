import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWorkOrderStore } from '../../store/workOrderStore'
import { useCustomerStore } from '../../store/customerStore'
import { useCompanyStore } from '../../store/companyStore'
import { useVehicleStore, type Vehicle } from '../../store/vehicleStore'
import { useScheduleRuleStore } from '../../store/scheduleRuleStore'
import { useServiceItemTypeStore } from '../../store/serviceItemTypeStore'
import { useReminderFollowUpStore } from '../../store/reminderFollowUpStore'
import { useProductStock } from '../../hooks/useProductStock'
import { useTranslation } from '../../lib/i18n'
import { isLowStock } from '../../lib/stockLedger'
import { ownerName, itemTypeNameLookup } from '../../lib/entities'
import { getVehicleReminders } from '../../lib/reminders'
import { computeDailyCustomerCounts, orderDate } from '../../lib/finance'
import { computeRepeatCustomerBuckets, computeAppointmentTrend } from '../../lib/dashboardMetrics'
import { buildHeatmapGrid } from '../../lib/heatmap'
import { useAppointmentStore } from '../../store/appointmentStore'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card'
import { Select } from '../ui/Input'
import { LowStockRail } from './LowStockRail'
import { ServiceRemindersRail } from './ServiceRemindersRail'
import { RepeatCustomerChart } from './RepeatCustomerChart'
import { AppointmentTrendChart } from './AppointmentTrendChart'
import { CustomerActivityHeatmap } from '../CustomerActivityHeatmap'
import { VehicleServiceHistoryDialog } from '../vehicles/VehicleServiceHistoryDialog'

const MONTH_KEYS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * Dashboard's trends-and-alerts section — low stock, the repeat-customer
 * rate chart, service reminders, the customer-activity heatmap, and the
 * appointment-volume trend chart.
 *
 * Split out of src/pages/Dashboard.tsx — see DashboardKpiSection's header
 * for the full reasoning. Owns `heatmapYear` and `historyVehicle` as local
 * state (including rendering VehicleServiceHistoryDialog itself) since
 * nothing outside this section's own cards ever reads either — unlike
 * `endOfToday`, there is no cross-section agreement to keep.
 */
export function DashboardTrendsSection({ endOfToday }: { endOfToday: Date }) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const workOrders = useWorkOrderStore((s) => s.workOrders)
  const customers = useCustomerStore((s) => s.customers)
  const companies = useCompanyStore((s) => s.companies)
  const vehicles = useVehicleStore((s) => s.vehicles)
  const scheduleRules = useScheduleRuleStore((s) => s.scheduleRules)
  const reminderFollowUps = useReminderFollowUpStore((s) => s.followUps)
  const serviceItemTypes = useServiceItemTypeStore((s) => s.serviceItemTypes)
  const appointments = useAppointmentStore((s) => s.appointments)
  const products = useProductStock()
  const itemTypeName = itemTypeNameLookup(serviceItemTypes)

  // Drives the service-history popup a reminders-card row opens on click — see
  // Vehicles.tsx's identical historyVehicle/VehicleServiceHistoryDialog pairing.
  const [historyVehicle, setHistoryVehicle] = useState<Vehicle | null>(null)
  const [heatmapYear, setHeatmapYear] = useState(() => new Date().getFullYear())

  const lowStockProducts = useMemo(() => products.filter(isLowStock), [products])

  // O(vehicles × rules) and a fresh array identity every render otherwise —
  // which re-rendered ServiceRemindersRail on every unrelated tick.
  const vehicleReminders = useMemo(
    () => getVehicleReminders(vehicles, scheduleRules, endOfToday, reminderFollowUps),
    [vehicles, scheduleRules, endOfToday, reminderFollowUps]
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

  // Completed-only — shared by availableYears and the heatmap grid below.
  // Passing all workOrders (including open/cancelled) to the grid used to
  // disagree with Reports.tsx's own heatmap, which was completed-only from
  // the start; this is now the one definition both pages share.
  const completedForHeatmap = useMemo(() => workOrders.filter((wo) => wo.status === 'completed'), [workOrders])
  const availableYears = useMemo(
    () =>
      [...new Set([new Date().getFullYear(), ...completedForHeatmap.map((wo) => orderDate(wo).getFullYear())])].sort(
        (a, b) => b - a
      ),
    [completedForHeatmap]
  )
  const customerActivityGrid = useMemo(
    () => buildHeatmapGrid(computeDailyCustomerCounts(completedForHeatmap, vehicles), heatmapYear),
    [completedForHeatmap, vehicles, heatmapYear]
  )

  const months = useMemo(() => MONTH_KEYS.map((k) => t(`dashboard.month${k}`)), [t]) // eslint-disable-line react-hooks/exhaustive-deps
  const currentMonthName = months[endOfToday.getMonth()]
  // Appointments per month, current year.
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Low Stock */}
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.lowStockAlert')}</CardTitle>
            <p className="text-caption">{t('dashboard.lowStockCaption', { count: lowStockProducts.length })}</p>
          </CardHeader>
          <CardContent>
            <LowStockRail items={lowStockProducts} onViewAll={() => navigate('/inventory')} />
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
            {availableYears.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
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
    </>
  )
}
