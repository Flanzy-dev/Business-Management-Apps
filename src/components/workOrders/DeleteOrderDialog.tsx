import type { WorkOrder } from '../../store/workOrderStore'
import { useTranslation } from '../../lib/i18n'
import { Dialog, DialogFooter } from '../ui/Dialog'
import { Button } from '../ui/Button'

/** Confirms deleting an order — a completed one gets an extra note since
 *  deleting it also reverses whatever stock it deducted. */
export function DeleteOrderDialog({ order, onClose, onConfirm }: { order: WorkOrder | null; onClose: () => void; onConfirm: () => void }) {
  const { t } = useTranslation()

  return (
    <Dialog open={!!order} onClose={onClose} title={t('workOrders.deleteOrderTitle')} size="sm">
      <p>{t('workOrders.deleteOrderMessage', { order: `SB-${order?.orderNumber}` })}</p>
      {order?.status === 'completed' && <p className="text-sm text-text-secondary mt-2">{t('workOrders.deleteOrderStockNote')}</p>}
      <DialogFooter>
        <Button variant="ghost" type="button" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button variant="danger" onClick={onConfirm}>
          {t('common.delete')}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
