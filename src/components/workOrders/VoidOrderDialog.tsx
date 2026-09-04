import { useEffect, useState } from 'react'
import { WorkOrder } from '../../store/workOrderStore'
import { voidOrder } from '../../lib/ops/orderOps'
import { useToastStore } from '../../store/toastStore'
import { useTranslation } from '../../lib/i18n'
import { Dialog, DialogFooter } from '../ui/Dialog'
import { Button } from '../ui/Button'
import { Textarea } from '../ui/Input'

/**
 * Void a completed order — keeps the row (status 'cancelled') with a reason
 * instead of hard-deleting the sale out of history. Shared by WorkOrderList's
 * dropdown and the read-only WorkOrderEditor. Renders nothing until `order`
 * is non-null.
 */
export function VoidOrderDialog({
  order,
  onClose,
  onVoided,
}: {
  order: WorkOrder | null
  onClose: () => void
  onVoided?: () => void
}) {
  const { t } = useTranslation()
  const showToast = useToastStore(s => s.show)
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (order) setReason('')
  }, [order?.id])

  if (!order) return null

  const handleVoid = () => {
    const res = voidOrder(order.id, reason.trim())
    onClose()
    if (!res.ok) {
      showToast({ tone: 'danger', title: t('workOrders.cannotCompleteTitle'), description: res.reason })
      return
    }
    showToast({ tone: 'success', title: t('workOrders.voidOrderDone', { order: `SB-${order.orderNumber}` }) })
    onVoided?.()
  }

  return (
    <Dialog
      open={!!order}
      onClose={onClose}
      title={t('workOrders.voidOrderTitle', { order: `SB-${order.orderNumber}` })}
      size="sm"
    >
      <div className="space-y-3">
        <p className="text-xs text-danger">{t('workOrders.voidOrderWarning')}</p>
        <Textarea
          label={t('workOrders.voidOrderReasonLabel')}
          value={reason}
          onChange={e => setReason(e.target.value)}
          rows={2}
          placeholder={t('workOrders.voidOrderReasonPlaceholder')}
        />
      </div>
      <DialogFooter>
        <Button variant="ghost" type="button" onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="danger" onClick={handleVoid} disabled={!reason.trim()}>{t('workOrders.voidOrderConfirm')}</Button>
      </DialogFooter>
    </Dialog>
  )
}
