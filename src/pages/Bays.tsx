import { useState } from 'react'
import { Warehouse, Wrench, Clock, AlertTriangle, CheckCircle, User, Car } from 'lucide-react'
import { useBayStore, Bay } from '../store/bayStore'
import { useWorkerStore } from '../store/workerStore'
import { useVehicleStore } from '../store/vehicleStore'
import { useWorkOrderStore } from '../store/workOrderStore'

const STATUS_CONFIG = {
  available: { label: 'Available', color: 'bg-accent-mint', textColor: 'text-accent-mint', bgColor: 'bg-accent-mint/20', icon: CheckCircle },
  'in-service': { label: 'In Service', color: 'bg-accent-amber', textColor: 'text-accent-amber', bgColor: 'bg-accent-amber/20', icon: Wrench },
  inspection: { label: 'Inspection', color: 'bg-accent-blue', textColor: 'text-accent-blue', bgColor: 'bg-accent-blue/20', icon: Clock },
  'awaiting-parts': { label: 'Awaiting Parts', color: 'bg-accent-critical', textColor: 'text-accent-critical', bgColor: 'bg-accent-critical/20', icon: AlertTriangle },
}

export default function Bays() {
  const { bays } = useBayStore()
  const { workers } = useWorkerStore()
  const { vehicles } = useVehicleStore()
  const { workOrders } = useWorkOrderStore()
  const [selectedBay, setSelectedBay] = useState<Bay | null>(null)

  const getWorkerName = (workerId: string | null) => {
    if (!workerId) return null
    const worker = workers.find(w => w.id === workerId)
    return worker?.name || 'Unknown'
  }

  const getVehicleFromWorkOrder = (workOrderId: string | null) => {
    if (!workOrderId) return null
    const workOrder = workOrders.find(wo => wo.id === workOrderId)
    if (!workOrder) return null
    const vehicle = vehicles.find(v => v.id === workOrder.vehicleId)
    return vehicle
  }

  const getTimeRemaining = (estimatedEndTime: string | null) => {
    if (!estimatedEndTime) return null
    const end = new Date(estimatedEndTime)
    const now = new Date()
    const diffMs = end.getTime() - now.getTime()
    if (diffMs <= 0) return 'Overdue'
    const mins = Math.ceil(diffMs / 60000)
    if (mins < 60) return `${mins}m remaining`
    return `${Math.floor(mins / 60)}h ${mins % 60}m remaining`
  }

  const availableBays = bays.filter(b => b.status === 'available').length
  const inServiceBays = bays.filter(b => b.status === 'in-service').length

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-page-title text-text-primary">Bay Status Board</h1>
          <p className="text-caption">{availableBays} available, {inServiceBays} in service</p>
        </div>
      </div>

      {/* Status Legend */}
      <div className="flex flex-wrap gap-4 mb-6">
        {Object.entries(STATUS_CONFIG).map(([key, config]) => (
          <div key={key} className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${config.color}`} />
            <span className="text-sm text-text-secondary">{config.label}</span>
          </div>
        ))}
      </div>

      {/* Bay Grid */}
      {bays.length === 0 ? (
        <div className="bg-surface-card rounded-card p-12 text-center">
          <Warehouse size={48} className="mx-auto mb-4 text-text-secondary opacity-50" />
          <h2 className="text-lg font-medium text-text-primary mb-2">No bays configured</h2>
          <p className="text-text-secondary mb-4">Add bays to start tracking your shop floor status.</p>
          <p className="text-caption">Bay management will be added in a future update.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {bays.map(bay => {
            const config = STATUS_CONFIG[bay.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.available
            const StatusIcon = config.icon
            const vehicle = getVehicleFromWorkOrder(bay.currentWorkOrderId)
            const workerName = getWorkerName(bay.assignedWorkerId)
            const timeRemaining = getTimeRemaining(bay.estimatedEndTime)

            return (
              <div
                key={bay.id}
                onClick={() => setSelectedBay(bay)}
                className={`bg-surface-card rounded-card p-4 border-2 cursor-pointer transition-all hover:border-accent-mint/50 ${
                  bay.status === 'awaiting-parts' ? 'border-accent-critical/50' : 'border-transparent'
                }`}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-text-primary">{bay.name}</h3>
                  <div className={`w-10 h-10 rounded-tile ${config.bgColor} flex items-center justify-center`}>
                    <StatusIcon size={20} className={config.textColor} />
                  </div>
                </div>

                {/* Status Badge */}
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-pill ${config.bgColor} mb-4`}>
                  <div className={`w-2 h-2 rounded-full ${config.color}`} />
                  <span className={`text-sm font-medium ${config.textColor}`}>{config.label}</span>
                </div>

                {/* Vehicle Info */}
                {vehicle ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-text-primary">
                      <Car size={16} className="text-text-secondary" />
                      <span className="text-sm font-medium">
                        {vehicle.year} {vehicle.make} {vehicle.model}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-caption font-mono">{vehicle.licensePlate || 'No plate'}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-text-secondary text-sm">No vehicle assigned</div>
                )}

                {/* Worker */}
                {workerName && (
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border-subtle">
                    <User size={14} className="text-text-secondary" />
                    <span className="text-sm text-text-secondary">{workerName}</span>
                  </div>
                )}

                {/* Time Remaining */}
                {timeRemaining && (
                  <div className="flex items-center gap-2 mt-2">
                    <Clock size={14} className="text-text-secondary" />
                    <span className={`text-sm ${timeRemaining === 'Overdue' ? 'text-accent-critical' : 'text-text-secondary'}`}>
                      {timeRemaining}
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Bay Detail Modal */}
      {selectedBay && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-surface-card rounded-card w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-text-primary mb-4">{selectedBay.name}</h2>
            <p className="text-text-secondary mb-4">Bay management actions coming soon.</p>
            <div className="flex justify-end">
              <button
                onClick={() => setSelectedBay(null)}
                className="px-4 py-2 text-text-secondary hover:text-text-primary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
