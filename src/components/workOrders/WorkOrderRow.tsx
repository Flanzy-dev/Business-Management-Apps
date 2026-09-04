import { Ban, Pencil, Printer, Trash2 } from 'lucide-react'
import type { WorkOrder } from '../../store/workOrderStore'
import type { Receivable } from '../../lib/receivables'
import { orderDisplayStatus, receivableBadgeTone, receivableStatusLabel } from '../../lib/receivables'
import { rowEditOnDoubleClick } from '../../lib/rowInteraction'
import { formatCurrency } from '../../lib/currency'
import { orderStatusLabel } from '../../lib/entities'
import { useTranslation } from '../../lib/i18n'
import { DropdownMenu, type DropdownMenuItem } from '../ui/DropdownMenu'
import { Badge, StatusBadge } from '../ui/Badge'

/** One order card: header line (number, status, receivable urgency badge),
 *  owner/vehicle/worker summary, total, and a status-dependent action menu —
 *  Edit only while open, Print/Void once completed (Void only for a mode
 *  that can void; otherwise Delete, since a completed order that shouldn't
 *  be voided still needs a way to fix a mis-entered one). */
export function WorkOrderRow({
  order,
  ownerName,
  vehicleDisplay,
  vehiclePlate,
  workerName,
  receivable,
  canVoid,
  onEdit,
  onPrint,
  onVoid,
  onDelete,
}: {
  order: WorkOrder
  ownerName: string
  vehicleDisplay: string
  vehiclePlate: string
  workerName: string
  receivable: Receivable | undefined
  canVoid: boolean
  onEdit: () => void
  onPrint: () => void
  onVoid: () => void
  onDelete: () => void
}) {
  const { t } = useTranslation()

  const menuItems: DropdownMenuItem[] = [
    ...(order.status === 'open' ? [{ label: t('common.edit'), icon: Pencil, onClick: onEdit }] : []),
    ...(order.status === 'completed' ? [{ label: t('workOrders.printAction'), icon: Printer, onClick: onPrint }] : []),
    ...(order.status === 'completed'
      ? canVoid
        ? [{ label: t('workOrders.voidOrderAction'), icon: Ban, onClick: onVoid, variant: 'danger' as const }]
        : []
      : [{ label: t('common.delete'), icon: Trash2, onClick: onDelete, variant: 'danger' as const }]),
  ]

  return (
    <div className="bg-surface-card rounded-radius-md overflow-hidden">
      <div
        className="p-4 flex justify-between items-center cursor-pointer hover:bg-surface-sunken active:bg-bg-4 transition-colors"
        {...rowEditOnDoubleClick(onEdit)}
      >
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-mono text-sm font-semibold text-accent">SB-{order.orderNumber}</h3>
            <StatusBadge status={orderDisplayStatus(order)} label={orderStatusLabel(orderDisplayStatus(order))} />
            {/* Only shown once it adds something beyond "Pending" — due-soon/overdue urgency. */}
            {receivable && receivable.tone !== 'on_track' && (
              <Badge tone={receivableBadgeTone(receivable)}>{receivableStatusLabel(receivable)}</Badge>
            )}
          </div>
          <p className="text-sm text-text-secondary">
            <span className="text-text-primary">{ownerName}</span>
            {' • '}{vehicleDisplay}
            {' • '}<span className="font-mono">{vehiclePlate}</span>
            {' • '}{workerName}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-mono font-semibold text-text-primary tabular-nums">{formatCurrency(order.total)}</span>
          <div onClick={(e) => e.stopPropagation()}>
            <DropdownMenu items={menuItems} />
          </div>
        </div>
      </div>
    </div>
  )
}
