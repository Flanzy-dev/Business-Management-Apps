import { useState } from 'react'
import { Warehouse, Car } from 'lucide-react'
import { useBayStore, Bay } from '../store/bayStore'
import { useWorkerStore } from '../store/workerStore'
import { useVehicleStore } from '../store/vehicleStore'
import { useWorkOrderStore } from '../store/workOrderStore'
import { useTranslation } from '../lib/i18n'
import { describeMinutesRemaining, minutesUntil } from '../lib/duration'
import { useTicker } from '../hooks/useTicker'
import { Dialog } from '../components/ui/Dialog'
import { Button } from '../components/ui/Button'
import { PageHeader } from '../components/ui/PageHeader'

// Same tick cadence as Dashboard.tsx's technician queue — this page's
// countdowns are the only thing on it that needs to advance on its own.
const CLOCK_TICK_MS = 60_000

const STATUS_KEYS = {
  available: { labelKey: 'statusAvailable', dotClass: 'bg-success', borderClass: 'border-t-success' },
  'in-service': { labelKey: 'statusInService', dotClass: 'bg-accent', borderClass: 'border-t-accent' },
  inspection: { labelKey: 'statusInspection', dotClass: 'bg-info', borderClass: 'border-t-info' },
  'awaiting-parts': { labelKey: 'statusAwaitingParts', dotClass: 'bg-danger', borderClass: 'border-t-danger' },
}

export default function Bays() {
  const { t } = useTranslation()
  const bays = useBayStore(s => s.bays)
  const workers = useWorkerStore(s => s.workers)
  const vehicles = useVehicleStore(s => s.vehicles)
  const workOrders = useWorkOrderStore(s => s.workOrders)
  const [selectedBay, setSelectedBay] = useState<Bay | null>(null)

  // Bay countdowns used to compute `new Date()` inline during render, so a
  // card's "12m left" never advanced until something else re-rendered the
  // page. Ticking `now` here is what makes it a real countdown.
  const now = useTicker(CLOCK_TICK_MS)

  const getWorkerName = (workerId: string | null) => {
    if (!workerId) return null
    const worker = workers.find(w => w.id === workerId)
    return worker?.name || t('common.unknown')
  }

  const getVehicleFromWorkOrder = (workOrderId: string | null) => {
    if (!workOrderId) return null
    const workOrder = workOrders.find(wo => wo.id === workOrderId)
    if (!workOrder) return null
    const vehicle = vehicles.find(v => v.id === workOrder.vehicleId)
    return vehicle
  }

  const getTimeRemaining = (estimatedEndTime: string | null): { text: string; overdue: boolean } | null => {
    if (!estimatedEndTime) return null
    const display = describeMinutesRemaining(minutesUntil(new Date(estimatedEndTime), now))
    if (display.kind === 'overdue') return { text: t('bays.overdue'), overdue: true }
    if (display.kind === 'minutes') return { text: t('bays.minutesLeft', { m: display.minutes }), overdue: false }
    return { text: t('bays.hoursMinutesLeft', { h: display.hours, m: display.minutes }), overdue: false }
  }

  const availableBays = bays.filter(b => b.status === 'available').length
  const inServiceBays = bays.filter(b => b.status === 'in-service').length

  return (
    <div>
      <PageHeader
        title={t('bays.pageTitle')}
        caption={t('bays.caption', { available: availableBays, inService: inServiceBays })}
      />

      {/* Legend (DESIGN.md §5.4) */}
      <div className="flex flex-wrap gap-x-6 gap-y-2 mb-6">
        {Object.entries(STATUS_KEYS).map(([key, config]) => (
          <div key={key} className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${config.dotClass}`} />
            <span className="text-sm text-text-secondary">{t(`bays.${config.labelKey}`)}</span>
          </div>
        ))}
      </div>

      {/* Bay Grid */}
      {bays.length === 0 ? (
        <div className="bg-surface-card rounded-radius-md p-12 text-center">
          <Warehouse size={48} className="mx-auto mb-4 text-text-secondary opacity-50" />
          <h2 className="text-lg font-medium text-text-primary mb-2">{t('bays.noBaysTitle')}</h2>
          <p className="text-text-secondary mb-4">{t('bays.noBaysMessage')}</p>
          <p className="text-caption">{t('bays.noBaysHint')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {bays.map(bay => {
            const config = STATUS_KEYS[bay.status as keyof typeof STATUS_KEYS] || STATUS_KEYS.available
            const vehicle = getVehicleFromWorkOrder(bay.currentWorkOrderId)
            const workerName = getWorkerName(bay.assignedWorkerId)
            const timeRemaining = getTimeRemaining(bay.estimatedEndTime)
            const isFree = bay.status === 'available'

            return (
              <div
                key={bay.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedBay(bay)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setSelectedBay(bay)
                  }
                }}
                className={`bg-surface-card rounded-radius-md border-t-[3px] p-4 min-h-[150px] flex flex-col cursor-pointer transition-colors hover:bg-bg-3 focus-ring ${config.borderClass}`}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-display text-base font-semibold text-text-primary">{bay.name}</h3>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${config.dotClass}`} />
                    <span className="text-xs text-text-secondary">{t(`bays.${config.labelKey}`)}</span>
                  </div>
                </div>

                {isFree ? (
                  <div className="flex-1 min-h-[88px] flex items-center justify-center">
                    <span className="text-sm text-fg-3">{t('bays.readyForNextVehicle')}</span>
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
                        <span className="text-xs font-mono text-fg-3">{vehicle.licensePlate || t('bays.noPlate')}</span>
                      </div>
                    ) : (
                      <div className="text-text-secondary text-sm">{t('bays.noVehicleAssigned')}</div>
                    )}

                    {/* Footer: technician left, mono time/status right (DESIGN.md §5.4) */}
                    {(workerName || timeRemaining) && (
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border-1">
                        <span className="text-sm text-text-secondary">{workerName || '—'}</span>
                        {timeRemaining && (
                          <span className={`font-mono text-xs ${timeRemaining.overdue ? 'text-danger' : 'text-accent'}`}>
                            {timeRemaining.text}
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
        <p className="text-text-secondary mb-4">{t('bays.detailComingSoon')}</p>
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => setSelectedBay(null)}>
            {t('common.close')}
          </Button>
        </div>
      </Dialog>
    </div>
  )
}
