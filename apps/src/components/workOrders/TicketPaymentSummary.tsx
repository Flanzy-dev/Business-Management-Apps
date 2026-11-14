import { CalendarPlus, MessageCircle, Printer } from 'lucide-react'
import { openExternalLink } from '../../lib/app/files'
import type { WorkOrder } from '../../store/workOrderStore'
import type { Receivable } from '../../lib/orders/receivables'
import { receivableBadgeTone, receivableStatusLabel } from '../../lib/orders/receivables'
import { formatCurrency } from '../../lib/format/numbers'
import { formatDate } from '../../lib/format/dates'
import { PAID_METHOD_KEYS } from '../../lib/orders/paymentMethods'
import { isTouchPrimary } from '../../lib/app/environment'
import { useTranslation } from '../../lib/i18n'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'

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
  onExtendDue,
  onPrint,
  thankYouUrl,
}: {
  order: WorkOrder
  /** From outstandingReceivables([order])[0] — undefined when the order isn't outstanding. */
  receivable: Receivable | undefined
  onRecordPayment?: () => void
  /** Admin only — when set, an unpaid order gets an "Extend due date" button. */
  onExtendDue?: () => void
  onPrint: () => void
  /** A wa.me link with the thank-you message ready — set only for a completed
   *  order whose owner has a phone number on file. */
  thankYouUrl?: string | null
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
            <span className="text-fg-1">{t(`workOrders.${PAID_METHOD_KEYS[order.paymentMethod]}`)}</span>
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
      {order.status === 'completed' && order.paymentMethod === 'pending' && onExtendDue && (
        <Button variant="secondary" size="touch" icon={CalendarPlus} onClick={onExtendDue} className="w-full mt-3">
          {t('receivables.extendDueAction')}
        </Button>
      )}
      {/* Printing stays a shop-PC job — see src/lib/app/environment.ts's
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
      {/* Works on any device, tablets included: the one way a customer gets
          their next-service date when there is no printer at the counter. */}
      {thankYouUrl && (
        <Button variant="secondary" size="touch" icon={MessageCircle} onClick={() => openExternalLink(thankYouUrl)} className="w-full mt-3">
          {t('workOrders.whatsappThanksButton')}
        </Button>
      )}
    </>
  )
}
