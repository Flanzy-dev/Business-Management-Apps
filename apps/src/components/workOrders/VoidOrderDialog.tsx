import { useEffect, useState } from 'react'
import { WorkOrder } from '../../store/workOrderStore'
import { voidOrder } from '../../lib/ops/orderOps'
import { useToastStore } from '../../store/uiStores'
import { useTranslation } from '../../lib/i18n'
import { Dialog, DialogFooter } from '../ui/Dialog'
import { Button } from '../ui/Button'
import { Textarea } from '../ui/Input'
import { useRequiredFields } from '../../hooks/useRequiredFields'
import { orderLabel } from '../../lib/format/entities'

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
  const { errors, validate, clear, reset } = useRequiredFields<'reason'>()

  useEffect(() => {
    if (order) {
      setReason('')
      reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reseeds only when the dialog opens or the record changes; depending on the record object or reset() would wipe what is being typed on every parent render
  }, [order?.id])

  if (!order) return null

  const handleVoid = () => {
    if (!validate({ reason })) return
    const res = voidOrder(order.id, reason.trim())
    onClose()
    if (!res.ok) {
      showToast({ tone: 'danger', title: t('workOrders.voidFailedTitle'), description: res.reason })
      return
    }
    showToast({ tone: 'success', title: t('workOrders.voidOrderDone', { order: orderLabel(order.orderNumber, order.orderNumberSuffix) }) })
    onVoided?.()
  }

  return (
    <Dialog closeOnScrimClick={false}
      open={!!order}
      onClose={onClose}
      title={t('workOrders.voidOrderTitle', { order: orderLabel(order.orderNumber, order.orderNumberSuffix) })}
      size="sm"
    >
      <div className="space-y-3">
        <p className="text-xs text-danger">{t('workOrders.voidOrderWarning')}</p>
        <Textarea
          label={t('workOrders.voidOrderReasonLabel')}
          value={reason}
          onChange={e => { setReason(e.target.value); clear('reason') }}
          aria-required="true"
          error={errors.reason}
          rows={2}
          placeholder={t('workOrders.voidOrderReasonPlaceholder')}
        />
      </div>
      <DialogFooter>
        <Button variant="ghost" type="button" onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="danger" onClick={handleVoid}>{t('workOrders.voidOrderConfirm')}</Button>
      </DialogFooter>
    </Dialog>
  )
}
