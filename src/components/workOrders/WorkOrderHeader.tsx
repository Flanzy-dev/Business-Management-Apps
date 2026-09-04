import type { WorkOrder } from '../../store/workOrderStore'
import type { Bay } from '../../store/bayStore'
import type { Vehicle } from '../../store/vehicleStore'
import type { Customer } from '../../store/customerStore'
import type { Company } from '../../store/companyStore'
import type { Worker } from '../../store/workerStore'
import { orderDisplayStatus } from '../../lib/receivables'
import { vehicleLabelWithPlate, ownerName, workerName, orderStatusLabel } from '../../lib/entities'
import { useTranslation } from '../../lib/i18n'
import { StatusBadge } from '../ui/Badge'
import { Select } from '../ui/Input'

/** WorkOrderEditor's title bar: back link, order number/status, owner and
 *  vehicle, the bay picker (editable orders only), and the complaint note. */
export function WorkOrderHeader({
  order,
  vehicle,
  customers,
  companies,
  workers,
  readOnly,
  assignedBayId,
  bayOptions,
  onBayChange,
  onBack,
  onEditDetails,
}: {
  order: WorkOrder
  vehicle: Vehicle | undefined
  customers: Customer[]
  companies: Company[]
  workers: Worker[]
  readOnly: boolean
  assignedBayId: string | undefined
  bayOptions: Bay[]
  onBayChange: (bayId: string) => void
  onBack: () => void
  onEditDetails: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="shrink-0 flex flex-wrap items-center gap-x-4 gap-y-2 mb-4">
      <button onClick={onBack} className="text-text-secondary hover:text-text-primary focus-ring rounded-radius-xs">
        {t('workOrders.backLink')}
      </button>
      <h1 className="text-page-title text-text-primary">Order SB-{order.orderNumber}</h1>
      <StatusBadge status={orderDisplayStatus(order)} label={orderStatusLabel(orderDisplayStatus(order))} />
      <p className="text-sm text-text-secondary">
        <span className="text-text-primary">{ownerName(vehicle, customers, companies)}</span>
        {' • '}
        {vehicleLabelWithPlate(vehicle)}
        {' • '}
        {workerName(order.workerId, workers)}
      </p>
      {!readOnly && (
        <button onClick={onEditDetails} className="text-sm text-accent hover:opacity-80 focus-ring rounded-radius-xs">
          {t('workOrders.editDetailsAction')}
        </button>
      )}
      {!readOnly && (
        <Select aria-label={t('workOrders.bayLabel')} value={assignedBayId ?? ''} onChange={(e) => onBayChange(e.target.value)} className="w-auto">
          <option value="">{t('workOrders.noBayOption')}</option>
          {bayOptions.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>
      )}
      {order.notes && (
        <p className="w-full text-xs text-fg-3">
          {t('workOrders.complaintHeaderLabel')} <span className="text-fg-2">{order.notes}</span>
        </p>
      )}
    </div>
  )
}
