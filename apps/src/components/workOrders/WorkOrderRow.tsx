import { Ban, Pencil, Printer, Trash2 } from 'lucide-react'
import type { WorkOrder } from '../../store/workOrderStore'
import type { Receivable } from '../../lib/orders/receivables'
import { orderDisplayStatus, receivableBadgeTone, receivableStatusLabel } from '../../lib/orders/receivables'
import { isTouchPrimary } from '../../lib/app/environment'
import { formatCurrency } from '../../lib/format/numbers'
import { formatDate } from '../../lib/format/dates'
import { orderStatusLabel, orderLabel } from '../../lib/format/entities'
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
    // No Print on a tablet: printing is a shop-PC job (src/lib/app/environment.ts).
    ...(order.status === 'completed' && !isTouchPrimary() ? [{ label: t('workOrders.printAction'), icon: Printer, onClick: onPrint }] : []),
    ...(order.status === 'completed'
      ? canVoid
        ? [{ label: t('workOrders.voidOrderAction'), icon: Ban, onClick: onVoid, variant: 'danger' as const }]
        : []
      : // An open order opened by mistake can be deleted by anyone. A voided one
        // is history the admin decided to keep: the host refuses a worker's
        // delete of it (server/tierPolicy.ts), so don't offer one.
        order.status === 'open' || canVoid
        ? [{ label: t('common.delete'), icon: Trash2, onClick: onDelete, variant: 'danger' as const }]
        : []),
  ]

  return (
    <div className="bg-surface-card border border-border-2 rounded-radius-md overflow-hidden flex items-center hover:bg-surface-sunken transition-colors">
      {/* One real button for the whole summary: a single click, tap or Enter
          opens the order (completed ones open read-only). The menu sits beside
          it, not inside, so the two never fight over a click. */}
      <button
        type="button"
        onClick={onEdit}
        className="flex-1 min-w-0 p-4 flex justify-between items-center gap-4 text-left cursor-pointer active:bg-bg-4 focus-ring rounded-radius-md"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-mono text-sm font-semibold text-accent">{orderLabel(order.orderNumber, order.orderNumberSuffix)}</h3>
            <StatusBadge status={orderDisplayStatus(order)} label={orderStatusLabel(orderDisplayStatus(order))} />
            {/* Only shown once it adds something beyond "Pending" — due-soon/overdue urgency. */}
            {receivable && receivable.tone !== 'on_track' && (
              <Badge tone={receivableBadgeTone(receivable)}>{receivableStatusLabel(receivable)}</Badge>
            )}
            <span className="text-xs text-fg-3 tabular-nums">{formatDate(order.date)}</span>
          </div>
          <p className="text-sm text-text-secondary truncate">
            <span className="text-text-primary">{ownerName}</span>
            {' • '}{vehicleDisplay}
            {' • '}<span className="font-mono">{vehiclePlate}</span>
            {' • '}{workerName}
          </p>
        </div>
        <span className="font-mono font-semibold text-text-primary tabular-nums shrink-0">{formatCurrency(order.total)}</span>
      </button>
      <div className="pr-3">
        <DropdownMenu items={menuItems} />
      </div>
    </div>
  )
}
