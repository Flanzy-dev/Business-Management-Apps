// A completed order's full money breakdown: line items split into Products
// and Services (matching CheckoutTicket.tsx's ticket and Receipt.tsx's
// printed receipt — every other money view in the app splits the same way),
// subtotal/discount/tax/total, payment/due status, the complaint note, and an
// optional Print button. Shared by src/components/serviceHistory/
// ServiceVisitList.tsx's expanded visit panel and Reminders.tsx's
// transaction-detail popup, so the two can't quietly drift apart on what
// "the detail of a transaction" shows.
import { Printer } from 'lucide-react'
import type { WorkOrder } from '../../store/workOrderStore'
import { groupOrderItemsByType } from '../../lib/orderItemGroups'
import { serviceTagLabel } from '../../lib/vehicleServiceHistory'
import { outstandingReceivables, receivableBadgeTone, receivableStatusLabel } from '../../lib/receivables'
import { formatCurrency } from '../../lib/currency'
import { formatDate } from '../../lib/dates'
import { useTranslation } from '../../lib/i18n'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'

const PAYMENT_METHOD_LABEL_KEYS: Record<Exclude<WorkOrder['paymentMethod'], 'pending'>, string> = {
  cash: 'paymentCash',
  qris: 'paymentQris',
  card: 'paymentCard',
  check: 'paymentCheck',
}

export function OrderBreakdown({
  order,
  itemTypeName,
  onPrint,
  className = '',
}: {
  order: WorkOrder
  itemTypeName: (id: string) => string
  /** Shows a "Print receipt" button. Omitted, it's hidden — a host with no receipt settings on hand can leave it out entirely. */
  onPrint?: (order: WorkOrder) => void
  className?: string
}) {
  const { t } = useTranslation()
  const groups = groupOrderItemsByType(order.items)

  const renderLine = (item: WorkOrder['items'][number]) => (
    <div key={item.id} className="flex items-center justify-between gap-2 text-xs">
      <span className="text-text-secondary truncate">
        {item.description} <span className="text-caption">x{item.quantity}</span>
        {serviceTagLabel(item, itemTypeName, t) && (
          <span className="ml-1.5 text-2xs uppercase tracking-wide text-accent">{serviceTagLabel(item, itemTypeName, t)}</span>
        )}
      </span>
      <span className="font-mono tabular-nums text-fg-1 flex-shrink-0">{formatCurrency(item.lineTotal)}</span>
    </div>
  )

  return (
    <div className={`space-y-1.5 text-sm ${className}`}>
      {groups.products.length > 0 && (
        <div className="space-y-1">
          <p className="text-2xs uppercase font-semibold tracking-wide text-fg-3">{t('workOrders.productsSectionLabel')}</p>
          {groups.products.map(renderLine)}
        </div>
      )}
      {groups.services.length > 0 && (
        <div className="space-y-1 mt-2">
          <p className="text-2xs uppercase font-semibold tracking-wide text-fg-3">{t('workOrders.servicesSectionLabel')}</p>
          {groups.services.map(renderLine)}
        </div>
      )}

      <div className="flex justify-between text-xs pt-1.5 mt-1.5 border-t border-border-subtle">
        <span className="text-text-secondary">{t('workOrders.subtotalLabel')}</span>
        <span className="font-mono tabular-nums text-fg-1">{formatCurrency(order.subtotal)}</span>
      </div>
      {order.discountAmount > 0 && (
        <div className="flex justify-between text-xs">
          <span className="text-text-secondary">{t('workOrders.discountLabel')}</span>
          <span className="font-mono tabular-nums text-fg-1">-{formatCurrency(order.discountAmount)}</span>
        </div>
      )}
      <div className="flex justify-between text-xs">
        <span className="text-text-secondary">{t('workOrders.taxLabel', { percent: order.taxPercent })}</span>
        <span className="font-mono tabular-nums text-fg-1">{formatCurrency(order.taxAmount)}</span>
      </div>
      <div className="flex justify-between text-sm font-semibold pt-1">
        <span className="text-text-primary">{t('workOrders.totalLabel')}</span>
        <span className="font-mono tabular-nums text-text-primary">{formatCurrency(order.total)}</span>
      </div>

      <div className="flex items-center justify-between gap-2 pt-1.5">
        {order.paymentMethod === 'pending' ? (
          (() => {
            const receivable = outstandingReceivables([order])[0]
            return (
              <>
                <span className="text-xs text-text-secondary">
                  {receivable?.dueDate
                    ? t('workOrders.unpaidDueLabel', { date: formatDate(receivable.dueDate) })
                    : t('workOrders.unpaidStatusLabel')}
                </span>
                {receivable && <Badge tone={receivableBadgeTone(receivable)}>{receivableStatusLabel(receivable)}</Badge>}
              </>
            )
          })()
        ) : (
          <span className="text-xs text-text-secondary">
            {t('workOrders.paymentMethodField')}{' '}
            <span className="text-fg-1">{t(`workOrders.${PAYMENT_METHOD_LABEL_KEYS[order.paymentMethod]}`)}</span>
          </span>
        )}
      </div>

      {order.notes && (
        <p className="text-xs text-text-secondary">
          {t('workOrders.complaintHeaderLabel')} <span className="text-fg-1">{order.notes}</span>
        </p>
      )}

      {onPrint && (
        <Button variant="secondary" size="sm" icon={Printer} onClick={() => onPrint(order)} className="w-full mt-2">
          {t('workOrders.printReceiptButton')}
        </Button>
      )}
    </div>
  )
}
