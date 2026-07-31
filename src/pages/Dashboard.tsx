import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { DollarSign, Car, Package, UserPlus } from 'lucide-react'
import { useWorkOrderStore } from '../store/workOrderStore'
import { useCustomerStore } from '../store/customerStore'
import { useCompanyStore } from '../store/companyStore'
import { useVehicleStore } from '../store/vehicleStore'
import { useScheduleRuleStore } from '../store/scheduleRuleStore'
import { useProductStock } from '../hooks/useProductStock'
import { useBayStore } from '../store/bayStore'
import { useAppointmentStore } from '../store/appointmentStore'
import { useWorkerStore } from '../store/workerStore'
import { formatCurrency } from '../lib/currency'
import { vehicleLabel, ownerName } from '../lib/entities'
import { getVehicleReminders } from '../lib/reminders'
import { computeDailyCustomerCounts } from '../lib/finance'
import { buildHeatmapGrid } from '../lib/heatmap'
import { useTranslation } from '../lib/i18n'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card'
import { StatusBadge } from '../components/ui/Badge'
import { StatCard } from '../components/dashboard/StatCard'
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

export default function Dashboard() {
  const navigate = useNavigate()
  const { t, language } = useTranslation()
  const workOrders = useWorkOrderStore(s => s.workOrders)
  const customers = useCustomerStore(s => s.customers)
  const companies = useCompanyStore(s => s.companies)
  const vehicles = useVehicleStore(s => s.vehicles)
  const scheduleRules = useScheduleRuleStore(s => s.scheduleRules)
  const products = useProductStock()
  const bays = useBayStore(s => s.bays)
  const appointments = useAppointmentStore(s => s.appointments)
  const workers = useWorkerStore(s => s.workers)

  const lowStockProducts = products.filter(p => p.qtyOnHand <= p.reorderPoint)
  const vehicleReminders = getVehicleReminders(vehicles, scheduleRules)

  // Lookup maps, built once per store change, so the derivations below do O(1)
  // key lookups instead of repeated O(n) .find() scans over the arrays.
  const vehicleById = useMemo(() => new Map(vehicles.map(v => [v.id, v])), [vehicles])
  const workerById = useMemo(() => new Map(workers.map(w => [w.id, w])), [workers])
  const workOrderById = useMemo(() => new Map(workOrders.map(wo => [wo.id, wo])), [workOrders])

  // Today's KPIs derived from completed orders (recomputed only when orders change)
  const { todaysRevenue, revenueDelta, vehiclesServiced, vehiclesDelta, partsUsedToday, partsDelta } = useMemo(() => {
    const today = new Date().toDateString()
    const yesterday = new Date(Date.now() - 86400000).toDateString()
    const todaysOrders = workOrders.filter(wo => wo.status === 'completed' && new Date(wo.completedAt || wo.createdAt).toDateString() === today)
    const yesterdaysOrders = workOrders.filter(wo => wo.status === 'completed' && new Date(wo.completedAt || wo.createdAt).toDateString() === yesterday)
    const todaysRevenue = todaysOrders.reduce((sum, wo) => sum + wo.total, 0)
    const yesterdaysRevenue = yesterdaysOrders.reduce((sum, wo) => sum + wo.total, 0)
    const vehiclesServiced = todaysOrders.length
    const vehiclesServicedYesterday = yesterdaysOrders.length
    const partsUsedToday = todaysOrders.reduce((sum, wo) => sum + wo.items.reduce((s, i) => s + i.quantity, 0), 0)
    const partsUsedYesterday = yesterdaysOrders.reduce((sum, wo) => sum + wo.items.reduce((s, i) => s + i.quantity, 0), 0)
    const pct = (a: number, b: number) => (b > 0 ? Math.round(((a - b) / b) * 100) : 0)
    return {
      todaysRevenue,
      revenueDelta: pct(todaysRevenue, yesterdaysRevenue),
      vehiclesServiced,
      vehiclesDelta: pct(vehiclesServiced, vehiclesServicedYesterday),
      partsUsedToday,
      partsDelta: pct(partsUsedToday, partsUsedYesterday),
    }
  }, [workOrders])

  const currentYear = new Date().getFullYear()
  const customerActivityGrid = useMemo(
    () => buildHeatmapGrid(computeDailyCustomerCounts(workOrders, vehicles), currentYear),
    [workOrders, vehicles, currentYear]
  )

  const { todaysCustomers, customersDelta } = useMemo(() => {
    const today = new Date().toDateString()
    const yesterday = new Date(Date.now() - 86400000).toDateString()
    const todaysCustomers = customers.filter(c => new Date(c.createdAt).toDateString() === today).length
    const yesterdaysCustomers = customers.filter(c => new Date(c.createdAt).toDateString() === yesterday).length
    return { todaysCustomers, customersDelta: yesterdaysCustomers > 0 ? Math.round(((todaysCustomers - yesterdaysCustomers) / yesterdaysCustomers) * 100) : 0 }
  }, [customers])

  // Bay capacity
  const { occupiedBays, bayCapacity } = useMemo(() => {
    const occupied = bays.filter(b => b.status !== 'available').length
    return { occupiedBays: occupied, bayCapacity: bays.length > 0 ? Math.round((occupied / bays.length) * 100) : 0 }
  }, [bays])

  // Bay status for mini board
  const bayStatusData = useMemo(() => bays.map(bay => {
    const workOrder = bay.currentWorkOrderId ? workOrderById.get(bay.currentWorkOrderId) : null
    const vehicle = workOrder ? vehicleById.get(workOrder.vehicleId) : null
    const worker = bay.assignedWorkerId ? workerById.get(bay.assignedWorkerId) : null
    return {
      id: bay.id,
      name: bay.name,
      status: bay.status,
      vehicleInfo: vehicle ? vehicleLabel(vehicle) : undefined,
      workerName: worker?.name,
    }
  }), [bays, workOrderById, vehicleById, workerById])

  // Service mix (top services by frequency)
  const serviceMix = useMemo(() => {
    const serviceCounts: Record<string, number> = {}
    workOrders.filter(wo => wo.status === 'completed').forEach(wo => {
      wo.items.forEach(item => {
        const name = item.description.split(' - ')[0] // Get service name before details
        serviceCounts[name] = (serviceCounts[name] || 0) + 1
      })
    })
    const totalServices = Object.values(serviceCounts).reduce((a, b) => a + b, 0)
    return Object.entries(serviceCounts)
      .map(([name, count]) => ({ name, count, share: totalServices > 0 ? Math.round((count / totalServices) * 100) : 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  }, [workOrders])

  // Chart data derived from the stores — no fabricated numbers.
  // Trailing 7 days of appointments, split scheduled vs walk-in.
  const throughputData = useMemo(() => {
    const days: { day: string; scheduled: number; walkIn: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dateStr = d.toDateString()
      const daysAppointments = appointments.filter(
        a => a.status !== 'cancelled' && new Date(a.scheduledAt).toDateString() === dateStr
      )
      days.push({
        day: d.toLocaleDateString(language === 'id' ? 'id-ID' : 'en-US', { weekday: 'short' }),
        scheduled: daysAppointments.filter(a => !a.isWalkIn).length,
        walkIn: daysAppointments.filter(a => a.isWalkIn).length,
      })
    }
    return days
  }, [appointments, language])

  // Completed orders from returning owners (owner had an earlier completed
  // order), bucketed by week-of-month, this month vs last month.
  const repeatData = useMemo(() => {
    const completed = workOrders
      .filter(wo => wo.status === 'completed')
      .sort((a, b) => new Date(a.completedAt || a.createdAt).getTime() - new Date(b.completedAt || b.createdAt).getTime())
    const seenVehicles = new Set<string>()
    const now = new Date()
    const buckets = { this: [0, 0, 0, 0], last: [0, 0, 0, 0] }
    completed.forEach(wo => {
      const isRepeat = seenVehicles.has(wo.vehicleId)
      seenVehicles.add(wo.vehicleId)
      if (!isRepeat) return
      const d = new Date(wo.completedAt || wo.createdAt)
      const week = Math.min(3, Math.floor((d.getDate() - 1) / 7))
      if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) {
        buckets.this[week]++
      } else if (
        d.getFullYear() === new Date(now.getFullYear(), now.getMonth() - 1, 1).getFullYear() &&
        d.getMonth() === new Date(now.getFullYear(), now.getMonth() - 1, 1).getMonth()
      ) {
        buckets.last[week]++
      }
    })
    return [0, 1, 2, 3].map(i => ({
      month: t('dashboard.weekN', { n: i + 1 }),
      lastMonth: buckets.last[i],
      thisMonth: buckets.this[i],
    }))
  }, [workOrders, t])

  const monthKeys = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const months = useMemo(() => monthKeys.map(k => t(`dashboard.month${k}`)), [t]) // eslint-disable-line react-hooks/exhaustive-deps
  const currentMonthName = months[new Date().getMonth()]
  // Appointments per month, current year.
  const appointmentTrendData = useMemo(() => {
    const year = new Date().getFullYear()
    return months.map((month, index) => ({
      month,
      appointments: appointments.filter(a => {
        const d = new Date(a.scheduledAt)
        return a.status !== 'cancelled' && d.getFullYear() === year && d.getMonth() === index
      }).length,
    }))
  }, [appointments, months])

  // In-service progress per worker: elapsed share of the order's estimated
  // window (order createdAt → bay estimatedEndTime), clamped to 5–95%.
  const techProgress = useMemo(() => {
    const map = new Map<string, number>()
    bays.forEach(bay => {
      if (bay.status !== 'in-service' || !bay.assignedWorkerId || !bay.estimatedEndTime) return
      const order = bay.currentWorkOrderId ? workOrderById.get(bay.currentWorkOrderId) : null
      if (!order) return
      const start = new Date(order.createdAt).getTime()
      const end = new Date(bay.estimatedEndTime).getTime()
      if (end <= start) return
      const pct = Math.round(((Date.now() - start) / (end - start)) * 100)
      map.set(bay.assignedWorkerId, Math.min(95, Math.max(5, pct)))
    })
    return map
  }, [bays, workOrderById])

  // Technician queue data - who's on which bay
  const technicianQueueData = useMemo(() => workers.map(worker => {
    const assignedBay = bays.find(b => b.assignedWorkerId === worker.id)
    const workOrder = assignedBay?.currentWorkOrderId ? workOrderById.get(assignedBay.currentWorkOrderId) : null
    const vehicle = workOrder ? vehicleById.get(workOrder.vehicleId) : null

    const getTimeRemaining = () => {
      if (!assignedBay?.estimatedEndTime) return undefined
      const end = new Date(assignedBay.estimatedEndTime)
      const now = new Date()
      const diffMs = end.getTime() - now.getTime()
      if (diffMs <= 0) return t('dashboard.overdue')
      const mins = Math.ceil(diffMs / 60000)
      if (mins < 60) return t('dashboard.minutesShort', { m: mins })
      return t('dashboard.hoursMinutesShort', { h: Math.floor(mins / 60), m: mins % 60 })
    }

    return {
      id: worker.id,
      name: worker.name,
      status: assignedBay && assignedBay.status !== 'available' ? 'busy' as const : 'available' as const,
      bayName: assignedBay?.name,
      vehicleInfo: vehicle ? vehicleLabel(vehicle) : undefined,
      timeRemaining: getTimeRemaining(),
      progress: assignedBay?.status === 'in-service' ? techProgress.get(worker.id) : undefined,
    }
  }), [workers, bays, workOrderById, vehicleById, techProgress, t])

  // Open work orders
  const openOrders = useMemo(() => workOrders.filter(wo => wo.status === 'open')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5), [workOrders])

  const getVehicleDisplay = (vehicleId: string) => vehicleLabel(vehicleById.get(vehicleId))
  const getOwnerName = (vehicleId: string) => ownerName(vehicleById.get(vehicleId), customers, companies)

  return (
    <div>
      {/* Hero header — "New order" lives in the topbar (Layout.tsx), not duplicated here */}
      <DashboardHero
        title={t('dashboard.heroTitle')}
        titleLine2={t('dashboard.heroTitleLine2')}
        description={t('dashboard.heroDescription')}
        stats={[
          { label: t('dashboard.heroRevenueToday'), value: formatCurrency(todaysRevenue) },
          { label: t('dashboard.heroOpenOrders'), value: openOrders.length.toString() },
          { label: t('dashboard.heroBaysInUse'), value: `${occupiedBays}/${bays.length}` },
        ]}
      />

      {/* KPI Row — joins the hero's entrance stagger as its last step */}
      <div className="animate-hero-reveal" style={{ animationDelay: '300ms' }}>
      <Card className="mb-6" padding="md">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title={t('dashboard.kpiRevenueToday')}
            value={formatCurrency(todaysRevenue)}
            icon={DollarSign}
            delta={revenueDelta}
          />
          <StatCard
            title={t('dashboard.kpiVehiclesServiced')}
            value={vehiclesServiced.toString()}
            icon={Car}
            delta={vehiclesDelta}
          />
          <StatCard
            title={t('dashboard.kpiPartsFiltersUsed')}
            value={partsUsedToday.toString()}
            icon={Package}
            delta={partsDelta}
          />
          <StatCard
            title={t('dashboard.kpiNewCustomers')}
            value={todaysCustomers.toString()}
            icon={UserPlus}
            delta={customersDelta}
          />
        </div>
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
            <BayCapacityGauge percentage={bayCapacity} />
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
            <button
              onClick={() => navigate('/technicians')}
              className="text-sm text-accent hover:opacity-80"
            >
              {t('dashboard.viewAll')}
            </button>
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
            onViewAll={() => navigate('/reminders')}
          />
        </CardContent>
      </Card>

      {/* Customer Activity Heatmap */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{t('dashboard.customerActivityHeading')}</CardTitle>
          <p className="text-caption">{t('dashboard.customerActivityCaption', { year: currentYear })}</p>
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

      {/* Open Work Orders */}
      {openOrders.length > 0 && (
        <Card>
          <CardHeader className="flex items-center justify-between">
            <div>
              <CardTitle>{t('dashboard.openWorkOrders')}</CardTitle>
              <p className="text-caption">{t('dashboard.openWorkOrdersCaption', { count: openOrders.length })}</p>
            </div>
            <button
              onClick={() => navigate('/work-orders')}
              className="text-sm text-accent hover:opacity-80"
            >
              {t('dashboard.viewAll')}
            </button>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {openOrders.map(wo => (
                <div
                  key={wo.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate('/work-orders')}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      navigate('/work-orders')
                    }
                  }}
                  className="flex justify-between items-center p-3 bg-bg-1 border border-border-1 rounded-radius-sm cursor-pointer hover:border-accent/30 transition-colors focus-ring"
                >
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-sm text-accent">#{wo.orderNumber}</span>
                    <span className="text-text-primary">{getOwnerName(wo.vehicleId)}</span>
                    <span className="text-caption">{getVehicleDisplay(wo.vehicleId)}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <StatusBadge status="open" />
                    <span className="font-mono font-medium text-text-primary tabular-nums">{formatCurrency(wo.total)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
