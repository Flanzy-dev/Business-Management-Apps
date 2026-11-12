import { useEffect, useState, type FormEvent } from 'react'
import { useWorkOrderStore, WorkOrder } from '../../store/workOrderStore'
import { useWorkerStore } from '../../store/workerStore'
import { useVehicleStore } from '../../store/vehicleStore'
import { useCustomerStore } from '../../store/customerStore'
import { useCompanyStore } from '../../store/companyStore'
import { useToastStore } from '../../store/uiStores'
import { applyVehicleChange } from '../../lib/orders/orderLifecycle'
import { vehicleLabelWithPlate } from '../../lib/format/entities'
import { useTranslation } from '../../lib/i18n'
import { Dialog, DialogFooter } from '../ui/Dialog'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { OrderDetailsFields } from './OrderDetailsFields'
import { QuickFindField } from './QuickFindField'

/**
 * Edit an OPEN order's vehicle, technician, complaint and arrival odometer
 * after creation — a mis-keyed order used to have to be deleted and
 * re-entered. The vehicle can change because nothing on an open order is
 * tied to it until completion; see orderLifecycle.ts's applyVehicleChange for
 * what moving it resets (odometer, a driver from another fleet).
 */
export function OrderDetailsDialog({ open, order, onClose }: { open: boolean; order: WorkOrder; onClose: () => void }) {
  const { t } = useTranslation()
  const updateWorkOrder = useWorkOrderStore(s => s.updateWorkOrder)
  const activeWorkers = useWorkerStore(s => s.getActiveWorkers)()
  const vehicles = useVehicleStore(s => s.vehicles)
  const customers = useCustomerStore(s => s.customers)
  const companies = useCompanyStore(s => s.companies)
  const showToast = useToastStore(s => s.show)

  const [workerId, setWorkerId] = useState(order.workerId ?? '')
  const [notes, setNotes] = useState(order.notes ?? '')
  const [odometer, setOdometer] = useState(order.odometerAtArrival != null ? String(order.odometerAtArrival) : '')
  const [vehicleId, setVehicleId] = useState(order.vehicleId)
  const [pickingVehicle, setPickingVehicle] = useState(false)

  useEffect(() => {
    if (!open) return
    setWorkerId(order.workerId ?? '')
    setNotes(order.notes ?? '')
    setOdometer(order.odometerAtArrival != null ? String(order.odometerAtArrival) : '')
    setVehicleId(order.vehicleId)
    setPickingVehicle(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, order.id])

  const vehicle = vehicles.find(v => v.id === vehicleId)

  const pickVehicle = (nextId: string) => {
    setVehicleId(nextId)
    setPickingVehicle(false)
    // The reading on file for the newly picked car, not the old one's.
    const next = vehicles.find(v => v.id === nextId)
    setOdometer(next?.currentMileage != null ? String(next.currentMileage) : '')
  }

  const handleSave = (e: FormEvent) => {
    e.preventDefault()
    let vehiclePatch = {}
    if (vehicleId !== order.vehicleId && vehicle) {
      const change = applyVehicleChange(order, vehicles.find(v => v.id === order.vehicleId), vehicle)
      if (!change.ok) {
        showToast({ tone: 'danger', title: change.reason })
        return
      }
      vehiclePatch = change.patch
    }
    updateWorkOrder(order.id, {
      ...vehiclePatch,
      workerId: workerId || null,
      notes: notes.trim(),
      odometerAtArrival: odometer.trim() ? parseInt(odometer, 10) : null,
    })
    onClose()
  }

  return (
    <Dialog closeOnScrimClick={false} open={open} onClose={onClose} title={t('workOrders.editDetailsTitle')} size="sm">
      <form onSubmit={handleSave}>
        <div className="space-y-4">
          <div>
            <p className="block text-2xs uppercase font-semibold tracking-wide text-fg-3 mb-1.5">{t('workOrders.vehicleLabel')}</p>
            {pickingVehicle ? (
              <QuickFindField
                vehicles={vehicles}
                customers={customers}
                companies={companies}
                onSelect={r => pickVehicle(r.vehicleId)}
              />
            ) : (
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-fg-1 truncate">{vehicle ? vehicleLabelWithPlate(vehicle) : '-'}</span>
                {order.status === 'open' && (
                  <Button variant="secondary" size="sm" type="button" onClick={() => setPickingVehicle(true)}>
                    {t('workOrders.changeVehicleButton')}
                  </Button>
                )}
              </div>
            )}
          </div>
          <OrderDetailsFields
            workerId={workerId}
            onWorkerChange={setWorkerId}
            activeWorkers={activeWorkers}
            notes={notes}
            onNotesChange={setNotes}
          />
          <Input
            type="number"
            label={t('workOrders.odometerAtArrivalLabel')}
            mono
            value={odometer}
            onChange={e => setOdometer(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" type="button" onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" type="submit">{t('common.save')}</Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
