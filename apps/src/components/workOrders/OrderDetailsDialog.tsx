import { useEffect, useState, type FormEvent } from 'react'
import { useWorkOrderStore, WorkOrder } from '../../store/workOrderStore'
import { useWorkerStore } from '../../store/workerStore'
import { useVehicleStore } from '../../store/vehicleStore'
import { useCustomerStore } from '../../store/customerStore'
import { useCompanyStore } from '../../store/companyStore'
import { useToastStore } from '../../store/uiStores'
import { applyVehicleChange } from '../../lib/orders/orderLifecycle'
import { vehicleLabelWithPlate } from '../../lib/format/entities'
import { ownerFields, ownerOf, type OwnerType } from '../../lib/vehicles/vehicleOwner'
import { useTranslation } from '../../lib/i18n'
import { Dialog, DialogFooter } from '../ui/Dialog'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { OwnerTypeRadios } from '../owners/OwnerTypeRadios'
import { OrderDetailsFields } from './OrderDetailsFields'
import { OwnerSelect } from './OwnerSelect'
import { QuickFindField } from './QuickFindField'

/**
 * Edit an OPEN order's vehicle, technician, complaint and arrival odometer
 * after creation — a mis-keyed order used to have to be deleted and
 * re-entered. The vehicle can change because nothing on an open order is
 * tied to it until completion; see orderLifecycle.ts's applyVehicleChange for
 * what moving it resets (odometer, a driver from another fleet).
 *
 * A counter sale (no vehicle) has no odometer to edit; here it can instead
 * name its buyer — which is what allows it to be left unpaid and invoiced — or
 * be given a vehicle after all, turning it into an ordinary service order.
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
  // The buyer of a counter sale, edited here as a type + id pair.
  const [ownerType, setOwnerType] = useState<OwnerType>(ownerOf(order)?.type ?? 'customer')
  const [ownerId, setOwnerId] = useState(ownerOf(order)?.id ?? '')

  useEffect(() => {
    if (!open) return
    setWorkerId(order.workerId ?? '')
    setNotes(order.notes ?? '')
    setOdometer(order.odometerAtArrival != null ? String(order.odometerAtArrival) : '')
    setVehicleId(order.vehicleId)
    setPickingVehicle(false)
    setOwnerType(ownerOf(order)?.type ?? 'customer')
    setOwnerId(ownerOf(order)?.id ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, order.id])

  const vehicle = vehicles.find(v => v.id === vehicleId)
  const counterSale = !vehicleId

  const pickVehicle = (nextId: string) => {
    setVehicleId(nextId)
    setPickingVehicle(false)
    // The reading on file for the newly picked car, not the old one's.
    const next = vehicles.find(v => v.id === nextId)
    setOdometer(next?.currentMileage != null ? String(next.currentMileage) : '')
  }

  const handleSave = (e: FormEvent) => {
    e.preventDefault()
    let vehiclePatch: Partial<WorkOrder> = {}
    if (vehicleId !== order.vehicleId && vehicle) {
      const change = applyVehicleChange(order, vehicles.find(v => v.id === order.vehicleId), vehicle)
      if (!change.ok) {
        showToast({ tone: 'danger', title: change.reason })
        return
      }
      // A counter sale becoming a service order: the car's owner is now the
      // customer, so the buyer named on the sale is cleared, not left behind.
      vehiclePatch = order.vehicleId ? change.patch : { ...change.patch, customerId: null, companyId: null }
    }
    updateWorkOrder(order.id, {
      ...vehiclePatch,
      // Still a counter sale: keep (or clear) its named buyer, and leave the odometer alone.
      ...(counterSale
        ? ownerFields(ownerId ? { type: ownerType, id: ownerId } : null)
        : { odometerAtArrival: odometer.trim() ? parseInt(odometer, 10) : null }),
      workerId: workerId || null,
      notes: notes.trim(),
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
                <span className="text-sm text-fg-1 truncate">
                  {counterSale ? t('workOrders.counterSaleVehicle') : vehicle ? vehicleLabelWithPlate(vehicle) : '-'}
                </span>
                {order.status === 'open' && (
                  <Button variant="secondary" size="sm" type="button" onClick={() => setPickingVehicle(true)}>
                    {counterSale ? t('workOrders.addVehicleButton') : t('workOrders.changeVehicleButton')}
                  </Button>
                )}
              </div>
            )}
          </div>
          {counterSale && (
            <>
              <OwnerTypeRadios
                value={ownerType}
                onChange={(next) => { setOwnerType(next); setOwnerId('') }}
                label={t('workOrders.ownerTypeLabel')}
                individualLabel={t('workOrders.individualCustomer')}
                companyLabel={t('workOrders.companyFleet')}
              />
              <OwnerSelect
                ownerType={ownerType}
                ownerId={ownerId}
                customers={customers}
                companies={companies}
                onSelectOwner={setOwnerId}
                label={t('workOrders.saleCustomerOptionalLabel')}
                emptyLabel={t('workOrders.saleWalkInOption')}
              />
            </>
          )}
          <OrderDetailsFields
            workerId={workerId}
            onWorkerChange={setWorkerId}
            activeWorkers={activeWorkers}
            notes={notes}
            onNotesChange={setNotes}
          />
          {!counterSale && (
            <Input
              type="number"
              label={t('workOrders.odometerAtArrivalLabel')}
              mono
              value={odometer}
              onChange={e => setOdometer(e.target.value)}
            />
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" type="button" onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" type="submit">{t('common.save')}</Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
