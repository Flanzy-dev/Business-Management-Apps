import { Printer } from 'lucide-react'
import type { WorkOrder } from '../../store/workOrderStore'
import type { Receivable } from '../../lib/receivables'
import { receivableBadgeTone, receivableStatusLabel } from '../../lib/receivables'
import { formatCurrency } from '../../lib/currency'
import { formatDate } from '../../lib/dates'
import { isTouchPrimary } from '../../lib/isTouchPrimary'
import { useTranslation } from '../../lib/i18n'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'

const PAYMENT_METHOD_LABEL_KEYS: Record<Exclude<WorkOrder['paymentMethod'], 'pending'>, string> = {
  cash: 'paymentCash',
  qris: 'paymentQris',
  card: 'paymentCard',
  check: 'paymentCheck',
}

/**
 * The read-only ticket's payment status block: unpaid/due banner, payment
 * method, cash tendered + change, the Record Payment shortcut for a
 * completed-but-unpaid order, and the Print Receipt button every completed/
 * voided order gets.
 */
export function TicketPaymentSummary({
  order,
  receivable,
  onRecordPayment,
  onPrint,
}: {
  order: WorkOrder
  /** From outstandingReceivables([order])[0] — undefined when the order isn't outstanding. */
  receivable: Receivable | undefined
  onRecordPayment?: () => void
  onPrint: () => void
}) {
  const { t } = useTranslation()
  return (
    <>
      {/* A voided order keeps whatever paymentMethod it completed with, but
          it's no longer collectible — the unpaid UI only makes sense for a
          still-completed order. */}
      {order.status === 'completed' && order.paymentMethod === 'pending' ? (
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-xs text-fg-3">
            {receivable?.dueDate ? t('workOrders.unpaidDueLabel', { date: formatDate(receivable.dueDate) }) : t('workOrders.unpaidStatusLabel')}
          </p>
          {receivable && <Badge tone={receivableBadgeTone(receivable)}>{receivableStatusLabel(receivable)}</Badge>}
        </div>
      ) : (
        order.paymentMethod !== 'pending' && (
          <p className="mt-2 text-xs text-fg-3">
            {t('workOrders.paymentMethodField')}{' '}
            <span className="text-fg-1">{t(`workOrders.${PAYMENT_METHOD_LABEL_KEYS[order.paymentMethod]}`)}</span>
          </p>
        )
      )}
      {order.paymentMethod === 'cash' && order.amountReceived != null && (
        <>
          <p className="mt-1 text-xs text-fg-3">
            {t('workOrders.cashReceivedField')} <span className="text-fg-1 tabular-nums">{formatCurrency(order.amountReceived)}</span>
          </p>
          <p className="text-xs text-fg-3">
            {t('workOrders.changeField')}{' '}
            <span className="text-fg-1 tabular-nums">{formatCurrency(Math.max(0, order.amountReceived - order.total))}</span>
          </p>
        </>
      )}
      {order.status === 'completed' && order.paymentMethod === 'pending' && onRecordPayment && (
        <Button variant="secondary" size="touch" onClick={onRecordPayment} className="w-full mt-3">
          {t('workOrders.recordPaymentAction')}
        </Button>
      )}
      {/* Printing stays a shop-PC job — see src/lib/isTouchPrimary.ts's
          header for why a touchscreen device's print button is disabled
          rather than hidden (hidden would look like the feature vanished;
          disabled-with-a-reason says why). The reason is a visible caption,
          not a title= tooltip — a tooltip never renders on the very touch
          devices this branch targets, which would make the disabled button
          unexplained for exactly the people who need the explanation. */}
      <Button variant="secondary" size="touch" icon={Printer} onClick={onPrint} disabled={isTouchPrimary()} className="w-full mt-3">
        {t('workOrders.printReceiptButton')}
      </Button>
      {isTouchPrimary() && <p className="mt-1 text-2xs text-fg-3 text-center">{t('workOrders.printFromShopPcHint')}</p>}
    </>
  )
}
