import { formatCurrency } from '../../lib/format/numbers'
import { useTranslation } from '../../lib/i18n'
import { sanitizeReceivedText, type PaymentMethod } from '../../lib/orders/paymentForm'
import { Input } from '../ui/Input'

/** The total, and the one field the picked method needs: for cash, the
 *  amount handed over (optional — empty means paid exactly) with a live
 *  change-due readout; for an unpaid order, its due date. Other methods need
 *  nothing more. */
export function PaymentConfirmStep({
  total,
  method,
  receivedText,
  onReceivedTextChange,
  change,
  dueDate,
  onDueDateChange,
}: {
  total: number
  method: PaymentMethod
  receivedText: string
  onReceivedTextChange: (value: string) => void
  change: number
  dueDate: string
  onDueDateChange: (value: string) => void
}) {
  const { t } = useTranslation()

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-baseline">
        <span className="text-sm text-text-secondary">{t('workOrders.totalLabel')}</span>
        <span className="font-mono tabular-nums text-lg font-semibold text-fg-1">{formatCurrency(total)}</span>
      </div>
      {method === 'cash' && (
        <>
          <Input
            type="text"
            inputMode="numeric"
            mono
            className="text-right"
            label={t('workOrders.amountReceivedLabel')}
            placeholder={formatCurrency(total)}
            hint={t('workOrders.paidExactlyHint')}
            value={receivedText}
            onChange={e => onReceivedTextChange(sanitizeReceivedText(e.target.value))}
            autoFocus
          />
          {/* Short says by how much, so a greyed-out Confirm explains itself. */}
          {receivedText !== '' && (change < 0 ? (
            <div className="flex justify-between text-sm text-danger" role="status">
              <span>{t('workOrders.shortByLabel')}</span>
              <span className="font-mono tabular-nums">{formatCurrency(-change)}</span>
            </div>
          ) : (
            <div className="flex justify-between text-sm text-fg-1">
              <span className="text-text-secondary">{t('workOrders.changeDueLabel')}</span>
              <span className="font-mono tabular-nums">{formatCurrency(change)}</span>
            </div>
          ))}
        </>
      )}
      {method === 'pending' && (
        <Input type="date" label={t('workOrders.paymentDueDateLabel')} value={dueDate} onChange={e => onDueDateChange(e.target.value)} />
      )}
    </div>
  )
}
