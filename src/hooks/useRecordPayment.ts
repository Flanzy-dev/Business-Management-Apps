import { WorkOrder } from '../store/workOrderStore'
import { useToastStore } from '../store/toastStore'
import { recordPayment } from '../lib/ops/orderOps'
import { useTranslation } from '../lib/i18n'

/**
 * Collect a completed order's outstanding debt and toast the result — the
 * exact same success/failure contract WorkOrderEditor and Reminders each
 * hand-duplicated (recordPayment + a two-key toast). Returns a function
 * rather than an object so a caller's own dialog-close state stays local:
 * only it knows which state hides its own payment dialog.
 */
export function useRecordPayment(): (
  orderId: string,
  method: WorkOrder['paymentMethod'],
  amountReceived: number | null
) => void {
  const showToast = useToastStore((s) => s.show)
  const { t } = useTranslation()

  return (orderId, method, amountReceived) => {
    const result = recordPayment(orderId, method, amountReceived)
    if (!result.ok) {
      showToast({ tone: 'danger', title: t('workOrders.cannotRecordPaymentTitle'), description: result.reason })
      return
    }
    showToast({
      tone: 'success',
      title: t('workOrders.paymentRecordedTitle'),
      description: t('workOrders.paymentRecordedDescription', { order: `SB-${result.order.orderNumber}` }),
    })
  }
}
