import type { WorkOrder } from '../../store/workOrderStore'
import { useTranslation } from '../../lib/i18n'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { orderLabel } from '../../lib/format/entities'

/** Confirms deleting an order — a completed one gets an extra note since
 *  deleting it also reverses whatever stock it deducted. */
export function DeleteOrderDialog({ order, onClose, onConfirm }: { order: WorkOrder | null; onClose: () => void; onConfirm: () => void }) {
  const { t } = useTranslation()
  const message = t('workOrders.deleteOrderMessage', { order: order ? orderLabel(order.orderNumber, order.orderNumberSuffix) : '' })

  return (
    <ConfirmDialog
      open={!!order}
      title={t('workOrders.deleteOrderTitle')}
      message={order?.status === 'completed' ? `${message} ${t('workOrders.deleteOrderStockNote')}` : message}
      tone="danger"
      onConfirm={onConfirm}
      onClose={onClose}
    />
  )
}
