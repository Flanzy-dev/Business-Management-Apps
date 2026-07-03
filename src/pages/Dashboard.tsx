import { useNavigate } from 'react-router-dom'
import { DollarSign, Car, Package, UserPlus, Plus } from 'lucide-react'
import { useWorkOrderStore } from '../store/workOrderStore'
import { useCustomerStore } from '../store/customerStore'
import { useVehicleStore } from '../store/vehicleStore'
import { useInventoryStore } from '../store/inventoryStore'
import { useBayStore } from '../store/bayStore'
import { useWorkerStore } from '../store/workerStore'
import { formatCurrency } from '../lib/currency'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card'
import { KPITile } from '../components/dashboard/KPITile'
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
  const { workOrders } = useWorkOrderStore()
  const { customers } = useCustomerStore()
  const { vehicles } = useVehicleStore()
  const { getLowStockProducts } = useInventoryStore()
  const { bays } = useBayStore()
  const { workers } = useWorkerStore()

  const lowStockProducts = getLowStockProducts()

  // Calculate today's stats
  const today = new Date().toDateString()
  const yesterday = new Date(Date.now() - 86400000).toDateString()

  const todaysOrders = workOrders.filter(wo =>
    wo.status === 'completed' && new Date(wo.completedAt || wo.createdAt).toDateString() === today
  )
  const yesterdaysOrders = workOrders.filter(wo =>
    wo.status === 'completed' && new Date(wo.completedAt || wo.createdAt).toDateString() === yesterday
  )

  const todaysRevenue = todaysOrders.reduce((sum, wo) => sum + wo.total, 0)
  const yesterdaysRevenue = yesterdaysOrders.reduce((sum, wo) => sum + wo.total, 0)
  const revenueDelta = yesterdaysRevenue > 0 ? Math.round(((todaysRevenue - yesterdaysRevenue) / yesterdaysRevenue) * 100) : 0

  const vehiclesServiced = todaysOrders.length
  const vehiclesServicedYesterday = yesterdaysOrders.length
  const vehiclesDelta = vehiclesServicedYesterday > 0 ? Math.round(((vehiclesServiced - vehiclesServicedYesterday) / vehiclesServicedYesterday) * 100) : 0

  // Parts used today (count items from today's orders)
  const partsUsedToday = todaysOrders.reduce((sum, wo) => sum + wo.items.reduce((s, i) => s + i.quantity, 0), 0)
  const partsUsedYesterday = yesterdaysOrders.reduce((sum, wo) => sum + wo.items.reduce((s, i) => s + i.quantity, 0), 0)
  const partsDelta = partsUsedYesterday > 0 ? Math.round(((partsUsedToday - partsUsedYesterday) / partsUsedYesterday) * 100) : 0

  // New customers today
  const todaysCustomers = customers.filter(c => new Date(c.createdAt).toDateString() === today).length
  const yesterdaysCustomers = customers.filter(c => new Date(c.createdAt).toDateString() === yesterday).length
  const customersDelta = yesterdaysCustomers > 0 ? Math.round(((todaysCustomers - yesterdaysCustomers) / yesterdaysCustomers) * 100) : 0

  // Bay capacity
  const occupiedBays = bays.filter(b => b.status !== 'available').length
  const bayCapacity = bays.length > 0 ? Math.round((occupiedBays / bays.length) * 100) : 0

  // Bay status for mini board
  const bayStatusData = bays.map(bay => {
    const workOrder = bay.currentWorkOrderId ? workOrders.find(wo => wo.id === bay.currentWorkOrderId) : null
    const vehicle = workOrder ? vehicles.find(v => v.id === workOrder.vehicleId) : null
    const worker = bay.assignedWorkerId ? workers.find(w => w.id === bay.assignedWorkerId) : null
    return {
      id: bay.id,
      name: bay.name,
      status: bay.status,
      vehicleInfo: vehicle ? `${vehicle.year || ''} ${vehicle.make} ${vehicle.model}`.trim() : undefined,
      workerName: worker?.name,
    }
  })

  // Service mix (top services by frequency)
  const serviceCounts: Record<string, number> = {}
  workOrders.filter(wo => wo.status === 'completed').forEach(wo => {
    wo.items.forEach(item => {
      const name = item.description.split(' - ')[0] // Get service name before details
      serviceCounts[name] = (serviceCounts[name] || 0) + 1
    })
  })
  const totalServices = Object.values(serviceCounts).reduce((a, b) => a + b, 0)
  const serviceMix = Object.entries(serviceCounts)
    .map(([name, count]) => ({
      name,
      count,
      share: totalServices > 0 ? Math.round((count / totalServices) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  // Mock throughput data (would come from real data in production)
  const throughputData = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => ({
    day,
    scheduled: Math.floor(Math.random() * 8) + 2,
    walkIn: Math.floor(Math.random() * 5) + 1,
  }))

  // Mock repeat customer data
  const repeatData = ['Week 1', 'Week 2', 'Week 3', 'Week 4'].map(month => ({
    month,
    lastMonth: Math.floor(Math.random() * 20) + 30,
    thisMonth: Math.floor(Math.random() * 20) + 35,
  }))

  // Mock appointment trend data (Jan-Dec)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const currentMonthIndex = new Date().getMonth()
  const currentMonthName = months[currentMonthIndex]
  const appointmentTrendData = months.map((month, index) => ({
    month,
    appointments: Math.floor(Math.random() * 50) + 80 + (index === 5 || index === 6 ? 30 : 0), // Summer spike
  }))

  // Technician queue data - who's on which bay
  const technicianQueueData = workers.map(worker => {
    const assignedBay = bays.find(b => b.assignedWorkerId === worker.id)
    const workOrder = assignedBay?.currentWorkOrderId
      ? workOrders.find(wo => wo.id === assignedBay.currentWorkOrderId)
      : null
    const vehicle = workOrder ? vehicles.find(v => v.id === workOrder.vehicleId) : null

    // Calculate time remaining (mock - would use real timestamps in production)
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
      vehicleInfo: vehicle ? `${vehicle.year || ''} ${vehicle.make} ${vehicle.model}`.trim() : undefined,
      timeRemaining: getTimeRemaining(),
      progress: assignedBay?.status === 'in-service' ? Math.floor(Math.random() * 60) + 20 : undefined,
    }
  })

  // Open work orders
  const openOrders = workOrders.filter(wo => wo.status === 'open')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5)

  const getVehicleDisplay = (vehicleId: string) => {
    const v = vehicles.find(x => x.id === vehicleId)
    if (!v) return 'Unknown'
    return `${v.year || ''} ${v.make} ${v.model}`.trim()
  }

  const getOwnerName = (vehicleId: string) => {
    const v = vehicles.find(x => x.id === vehicleId)
    if (!v) return 'Unknown'
    if (v.customerId) {
      const c = customers.find(x => x.id === v.customerId)
      return c?.name || 'Unknown'
    }
    return 'Fleet'
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-page-title text-text-primary">Dashboard</h1>
          <p className="text-caption">Welcome back. Here's what's happening today.</p>
        </div>
        <button
          onClick={() => navigate('/work-orders')}
          className="flex items-center gap-2 bg-accent-mint text-surface-canvas px-4 py-2 rounded-tile hover:opacity-90 transition-opacity font-medium"
        >
          <Plus size={18} />
          New Work Order
        </button>
      </div>

      {/* KPI Row */}
      <Card className="mb-6" padding="md">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPITile
            title="Revenue Today"
            value={formatCurrency(todaysRevenue)}
            icon={DollarSign}
            delta={revenueDelta}
          />
          <KPITile
            title="Vehicles Serviced"
            value={vehiclesServiced.toString()}
            icon={Car}
            delta={vehiclesDelta}
          />
          <KPITile
            title="Parts/Filters Used"
            value={partsUsedToday.toString()}
            icon={Package}
            delta={partsDelta}
          />
          <KPITile
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
              className="text-sm text-accent-mint hover:opacity-80"
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
              className="text-sm text-accent-mint hover:opacity-80"
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Bay Throughput */}
        <Card>
          <CardHeader>
            <CardTitle>Bay Throughput</CardTitle>
            <p className="text-caption">Scheduled vs Walk-in, trailing 7 days</p>
          </CardHeader>
          <CardContent>
            <BayThroughputChart data={throughputData} />
          </CardContent>
        </Card>
      </div>

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
              className="text-sm text-accent-mint hover:opacity-80"
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
                  className="flex justify-between items-center p-3 bg-surface-sunken rounded-tile cursor-pointer hover:border-accent-mint/30 border border-transparent transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-sm text-text-primary">#{wo.orderNumber}</span>
                    <span className="text-text-primary">{getOwnerName(wo.vehicleId)}</span>
                    <span className="text-caption">{getVehicleDisplay(wo.vehicleId)}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="px-2 py-1 rounded-pill bg-accent-amber/20 text-accent-amber text-xs font-medium">
                      Open
                    </span>
                    <span className="font-medium text-text-primary tabular-nums">{formatCurrency(wo.total)}</span>
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
