import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { DollarSign, Car, Package, UserPlus } from 'lucide-react'
import { useWorkOrderStore } from '../store/workOrderStore'
import { useCustomerStore } from '../store/customerStore'
import { useCompanyStore } from '../store/companyStore'
import { useVehicleStore } from '../store/vehicleStore'
import { useInventoryStore } from '../store/inventoryStore'
import { useBayStore } from '../store/bayStore'
import { useWorkerStore } from '../store/workerStore'
import { formatCurrency } from '../lib/currency'
import { vehicleLabel, ownerName } from '../lib/entities'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { StatCard } from '../components/dashboard/StatCard'
import { BayCapacityGauge } from '../components/dashboard/BayCapacityGauge'
import { BayStatusBoard } from '../components/dashboard/BayStatusBoard'
import { ServiceMixTable } from '../components/dashboard/ServiceMixTable'
import { BayThroughputChart } from '../components/dashboard/BayThroughputChart'
import { LowStockRail } from '../components/dashboard/LowStockRail'
import { RepeatCustomerChart } from '../components/dashboard/RepeatCustomerChart'
import { AppointmentTrendChart } from '../components/dashboard/AppointmentTrendChart'
import { TechnicianQueue } from '../components/dashboard/TechnicianQueue'

export default function Dashboard() {
  const navigate = useNavigate()
  const workOrders = useWorkOrderStore(s => s.workOrders)
  const customers = useCustomerStore(s => s.customers)
  const companies = useCompanyStore(s => s.companies)
  const vehicles = useVehicleStore(s => s.vehicles)
  const getLowStockProducts = useInventoryStore(s => s.getLowStockProducts)
  const bays = useBayStore(s => s.bays)
  const workers = useWorkerStore(s => s.workers)

  const lowStockProducts = getLowStockProducts()

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

  // Mock chart data — generated once per mount (empty deps) so it doesn't
  // regenerate and flicker on every unrelated re-render. Real data in production.
  const throughputData = useMemo(() => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => ({
    day,
    scheduled: Math.floor(Math.random() * 8) + 2,
    walkIn: Math.floor(Math.random() * 5) + 1,
  })), [])

  const repeatData = useMemo(() => ['Week 1', 'Week 2', 'Week 3', 'Week 4'].map(month => ({
    month,
    lastMonth: Math.floor(Math.random() * 20) + 30,
    thisMonth: Math.floor(Math.random() * 20) + 35,
  })), [])

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const currentMonthName = months[new Date().getMonth()]
  const appointmentTrendData = useMemo(() => months.map((month, index) => ({
    month,
    appointments: Math.floor(Math.random() * 50) + 80 + (index === 5 || index === 6 ? 30 : 0), // Summer spike
  })), [])

  // Stable per-worker mock progress so it doesn't re-randomize when bays change
  const techProgress = useMemo(() => new Map(workers.map(w => [w.id, Math.floor(Math.random() * 60) + 20])), [workers])

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
      if (diffMs <= 0) return 'Overdue'
      const mins = Math.ceil(diffMs / 60000)
      if (mins < 60) return `${mins}m`
      return `${Math.floor(mins / 60)}h ${mins % 60}m`
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
  }), [workers, bays, workOrderById, vehicleById, techProgress])

  // Open work orders
  const openOrders = useMemo(() => workOrders.filter(wo => wo.status === 'open')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5), [workOrders])

  const getVehicleDisplay = (vehicleId: string) => vehicleLabel(vehicleById.get(vehicleId))
  const getOwnerName = (vehicleId: string) => ownerName(vehicleById.get(vehicleId), customers, companies)

  return (
    <div className="p-6">
      {/* Header — "New order" lives in the topbar (Layout.tsx) now, not duplicated here */}
      <div className="mb-6">
        <h1 className="text-page-title text-text-primary">Dashboard</h1>
        <p className="text-caption">Welcome back. Here's what's happening today.</p>
      </div>

      {/* KPI Row */}
      <Card className="mb-6" padding="md">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Revenue Today"
            value={formatCurrency(todaysRevenue)}
            icon={DollarSign}
            delta={revenueDelta}
          />
          <StatCard
            title="Vehicles Serviced"
            value={vehiclesServiced.toString()}
            icon={Car}
            delta={vehiclesDelta}
          />
          <StatCard
            title="Parts/Filters Used"
            value={partsUsedToday.toString()}
            icon={Package}
            delta={partsDelta}
          />
          <StatCard
            title="New Customers"
            value={todaysCustomers.toString()}
            icon={UserPlus}
            delta={customersDelta}
          />
        </div>
      </Card>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Bay Capacity Gauge */}
        <Card>
          <CardHeader>
            <CardTitle>Bay Capacity</CardTitle>
          </CardHeader>
          <CardContent>
            <BayCapacityGauge percentage={bayCapacity} />
            <p className="text-center text-caption mt-2">
              {occupiedBays} of {bays.length} bays in use
            </p>
          </CardContent>
        </Card>

        {/* Bay Status Mini Board */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Bay Status</CardTitle>
            <button
              onClick={() => navigate('/bays')}
              className="text-sm text-accent hover:opacity-80"
            >
              View all →
            </button>
          </CardHeader>
          <CardContent>
            <BayStatusBoard bays={bayStatusData} compact />
          </CardContent>
        </Card>
      </div>

      {/* Technician Queue + Service Mix Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Technician Assignment Queue */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <div>
              <CardTitle>Technician Queue</CardTitle>
              <p className="text-caption">Who's on which bay, current job</p>
            </div>
            <button
              onClick={() => navigate('/technicians')}
              className="text-sm text-accent hover:opacity-80"
            >
              View all →
            </button>
          </CardHeader>
          <CardContent>
            <TechnicianQueue technicians={technicianQueueData} />
          </CardContent>
        </Card>

        {/* Service Mix */}
        <Card>
          <CardHeader>
            <CardTitle>Service Mix</CardTitle>
            <p className="text-caption">Share of tickets by service type</p>
          </CardHeader>
          <CardContent>
            <ServiceMixTable services={serviceMix} />
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Bay Throughput</CardTitle>
          <p className="text-caption">Scheduled vs Walk-in, trailing 7 days</p>
        </CardHeader>
        <CardContent>
          <BayThroughputChart data={throughputData} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Low Stock */}
        <Card>
          <CardHeader>
            <CardTitle>Low Stock Alert</CardTitle>
            <p className="text-caption">{lowStockProducts.length} items below reorder point</p>
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
            <CardTitle>Repeat Customer Rate</CardTitle>
            <p className="text-caption">Last month vs this month</p>
          </CardHeader>
          <CardContent>
            <RepeatCustomerChart data={repeatData} />
          </CardContent>
        </Card>
      </div>

      {/* Appointment Trend */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Appointment Volume Trend</CardTitle>
          <p className="text-caption">Scheduled + walk-in appointments, Jan–Dec (seasonal view)</p>
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
              <CardTitle>Open Work Orders</CardTitle>
              <p className="text-caption">{openOrders.length} orders in progress</p>
            </div>
            <button
              onClick={() => navigate('/work-orders')}
              className="text-sm text-accent hover:opacity-80"
            >
              View all →
            </button>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {openOrders.map(wo => (
                <div
                  key={wo.id}
                  onClick={() => navigate('/work-orders')}
                  className="flex justify-between items-center p-3 bg-bg-1 border border-border-1 rounded-radius-sm cursor-pointer hover:border-accent/30 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-sm text-accent">#{wo.orderNumber}</span>
                    <span className="text-text-primary">{getOwnerName(wo.vehicleId)}</span>
                    <span className="text-caption">{getVehicleDisplay(wo.vehicleId)}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge tone="warning" dot>Open</Badge>
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
