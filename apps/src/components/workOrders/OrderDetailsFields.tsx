import type { Worker } from '../../store/workerStore'
import { useTranslation } from '../../lib/i18n'
import { Select, Textarea } from '../ui/Input'

/**
 * The technician + complaint pair shared verbatim by NewWorkOrderDialog
 * (create) and OrderDetailsDialog (edit) — was hand-duplicated between the
 * two, which is exactly the shape of bug that lets create and edit silently
 * drift on which fields exist. The odometer field deliberately stays out of
 * this component: NewWorkOrderDialog's version carries a last-known-mileage
 * placeholder/hint and sits earlier in the form (before the driver picker),
 * while OrderDetailsDialog's is a bare input — genuinely different fields,
 * not the same one duplicated, so each dialog keeps its own.
 */
export function OrderDetailsFields({
  workerId,
  onWorkerChange,
  activeWorkers,
  notes,
  onNotesChange,
}: {
  workerId: string
  onWorkerChange: (id: string) => void
  activeWorkers: Worker[]
  notes: string
  onNotesChange: (value: string) => void
}) {
  const { t } = useTranslation()
  return (
    <>
      <Select label={t('workOrders.assignedWorkerLabel')} value={workerId} onChange={(e) => onWorkerChange(e.target.value)}>
        <option value="">{t('workOrders.selectWorker')}</option>
        {activeWorkers.map((w) => (
          <option key={w.id} value={w.id}>{w.name}</option>
        ))}
      </Select>
      <Textarea
        label={t('workOrders.complaintLabel')}
        placeholder={t('workOrders.complaintPlaceholder')}
        value={notes}
        onChange={(e) => onNotesChange(e.target.value)}
        rows={2}
      />
    </>
  )
}
