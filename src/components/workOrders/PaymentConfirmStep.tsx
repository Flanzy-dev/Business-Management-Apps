import { formatCurrency } from '../../lib/currency'
import { useTranslation } from '../../lib/i18n'
import { Input } from '../ui/Input'
import { METHOD_KEYS, type PaymentMethod } from './PaymentMethodList'

/** Step two: the total, the picked method, and (cash/pending only) the
 *  field each of those needs — amount received with a live change-due
 *  readout, or a due date. */
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
      <div className="flex justify-between text-sm">
        <span className="text-text-secondary">{t('workOrders.totalLabel')}</span>
        <span className="font-mono tabular-nums text-fg-1">{formatCurrency(total)}</span>
      </div>
      <div className="text-sm text-text-secondary">{t(`workOrders.${METHOD_KEYS[method]}`)}</div>
      {method === 'cash' && (
        <>
          <Input
            type="text"
            inputMode="numeric"
            mono
            className="text-right"
            label={t('workOrders.amountReceivedLabel')}
            value={receivedText}
            onChange={e => onReceivedTextChange(e.target.value.replace(/[^0-9]/g, ''))}
            autoFocus
          />
          {receivedText !== '' && (
            <div className={`flex justify-between text-sm ${change < 0 ? 'text-danger' : 'text-fg-1'}`}>
              <span className="text-text-secondary">{t('workOrders.changeDueLabel')}</span>
              <span className="font-mono tabular-nums">{formatCurrency(Math.max(0, change))}</span>
            </div>
          )}
        </>
      )}
      {method === 'pending' && (
        <Input type="date" label={t('workOrders.paymentDueDateLabel')} value={dueDate} onChange={e => onDueDateChange(e.target.value)} />
      )}
    </div>
  )
}
