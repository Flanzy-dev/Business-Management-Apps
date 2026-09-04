import { useEffect, useState } from 'react'
import { useWorkOrderStore, WorkOrder } from '../../store/workOrderStore'
import { useWorkerStore } from '../../store/workerStore'
import { useTranslation } from '../../lib/i18n'
import { Dialog, DialogFooter } from '../ui/Dialog'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { OrderDetailsFields } from './OrderDetailsFields'

/**
 * Edit an OPEN order's technician, complaint, and arrival odometer after
 * creation — until now these were captured once in NewWorkOrderDialog and a
 * mis-keyed order had to be deleted and re-entered. Vehicle/driver stay
 * immutable (they touch stock reservations and schedule targeting).
 */
export function OrderDetailsDialog({ open, order, onClose }: { open: boolean; order: WorkOrder; onClose: () => void }) {
  const { t } = useTranslation()
  const updateWorkOrder = useWorkOrderStore(s => s.updateWorkOrder)
  const activeWorkers = useWorkerStore(s => s.getActiveWorkers)()

  const [workerId, setWorkerId] = useState(order.workerId ?? '')
  const [notes, setNotes] = useState(order.notes ?? '')
  const [odometer, setOdometer] = useState(order.odometerAtArrival != null ? String(order.odometerAtArrival) : '')

  useEffect(() => {
    if (!open) return
    setWorkerId(order.workerId ?? '')
    setNotes(order.notes ?? '')
    setOdometer(order.odometerAtArrival != null ? String(order.odometerAtArrival) : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, order.id])

  const handleSave = () => {
    updateWorkOrder(order.id, {
      workerId: workerId || null,
      notes: notes.trim(),
      odometerAtArrival: odometer.trim() ? parseInt(odometer, 10) : null,
    })
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} title={t('workOrders.editDetailsTitle')} size="sm">
      <div className="space-y-4">
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
        <Button variant="primary" onClick={handleSave}>{t('common.save')}</Button>
      </DialogFooter>
    </Dialog>
  )
}
