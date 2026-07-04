import { useState } from 'react'
import { Warehouse, Car } from 'lucide-react'
import { useBayStore, Bay } from '../store/bayStore'
import { useWorkerStore } from '../store/workerStore'
import { useVehicleStore } from '../store/vehicleStore'
import { useWorkOrderStore } from '../store/workOrderStore'
import { Dialog } from '../components/ui/Dialog'
import { Button } from '../components/ui/Button'

const STATUS_CONFIG = {
  available: { label: 'Available', dotClass: 'bg-success', borderClass: 'border-t-success' },
  'in-service': { label: 'In service', dotClass: 'bg-accent', borderClass: 'border-t-accent' },
  inspection: { label: 'Inspection', dotClass: 'bg-info', borderClass: 'border-t-info' },
  'awaiting-parts': { label: 'Awaiting parts', dotClass: 'bg-danger', borderClass: 'border-t-danger' },
}

export default function Bays() {
  const bays = useBayStore(s => s.bays)
  const workers = useWorkerStore(s => s.workers)
  const vehicles = useVehicleStore(s => s.vehicles)
  const workOrders = useWorkOrderStore(s => s.workOrders)
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
    if (mins < 60) return `${mins}m left`
    return `${Math.floor(mins / 60)}h ${mins % 60}m left`
  }

  const availableBays = bays.filter(b => b.status === 'available').length
  const inServiceBays = bays.filter(b => b.status === 'in-service').length

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-page-title text-text-primary">Bay status board</h1>
        <p className="text-caption">{availableBays} available, {inServiceBays} in service</p>
      </div>

      {/* Legend (DESIGN.md §5.4) */}
      <div className="flex flex-wrap gap-x-6 gap-y-2 mb-6">
        {Object.entries(STATUS_CONFIG).map(([key, config]) => (
          <div key={key} className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${config.dotClass}`} />
            <span className="text-sm text-text-secondary">{config.label}</span>
          </div>
        ))}
      </div>

      {/* Bay Grid */}
      {bays.length === 0 ? (
        <div className="bg-surface-card rounded-radius-md p-12 text-center">
          <Warehouse size={48} className="mx-auto mb-4 text-text-secondary opacity-50" />
          <h2 className="text-lg font-medium text-text-primary mb-2">No bays configured</h2>
          <p className="text-text-secondary mb-4">Add bays to start tracking your shop floor status.</p>
          <p className="text-caption">Bay management will be added in a future update.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {bays.map(bay => {
            const config = STATUS_CONFIG[bay.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.available
            const vehicle = getVehicleFromWorkOrder(bay.currentWorkOrderId)
            const workerName = getWorkerName(bay.assignedWorkerId)
            const timeRemaining = getTimeRemaining(bay.estimatedEndTime)
            const isFree = bay.status === 'available'

            return (
              <div
                key={bay.id}
                onClick={() => setSelectedBay(bay)}
                className={`bg-surface-card rounded-radius-md border-t-[3px] p-4 min-h-[150px] flex flex-col cursor-pointer transition-colors hover:bg-bg-3 ${config.borderClass}`}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-display text-base font-semibold text-text-primary">{bay.name}</h3>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${config.dotClass}`} />
                    <span className="text-xs text-text-secondary">{config.label}</span>
                  </div>
                </div>

                {isFree ? (
                  <div className="flex-1 min-h-[88px] flex items-center justify-center">
                    <span className="text-sm text-fg-3">Ready for next vehicle</span>
                  </div>
                ) : (
                  <>
                    {vehicle ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-text-primary">
                          <Car size={16} className="text-text-secondary flex-shrink-0" />
                          <span className="text-sm font-medium">
                            {vehicle.year} {vehicle.make} {vehicle.model}
                          </span>
                        </div>
                        <span className="text-xs font-mono text-fg-3">{vehicle.licensePlate || 'No plate'}</span>
                      </div>
                    ) : (
                      <div className="text-text-secondary text-sm">No vehicle assigned</div>
                    )}

                    {/* Footer: technician left, mono time/status right (DESIGN.md §5.4) */}
                    {(workerName || timeRemaining) && (
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border-1">
                        <span className="text-sm text-text-secondary">{workerName || '—'}</span>
                        {timeRemaining && (
                          <span className={`font-mono text-xs ${timeRemaining === 'Overdue' ? 'text-danger' : 'text-accent'}`}>
                            {timeRemaining}
                          </span>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Bay Detail Dialog */}
      <Dialog open={!!selectedBay} onClose={() => setSelectedBay(null)} title={selectedBay?.name}>
        <p className="text-text-secondary mb-4">Bay management actions coming soon.</p>
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => setSelectedBay(null)}>
            Close
          </Button>
        </div>
      </Dialog>
    </div>
  )
}
