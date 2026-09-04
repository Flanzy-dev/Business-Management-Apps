import { useEffect, useState } from 'react'
import { useTranslation } from '../../lib/i18n'
import { Dialog, DialogFooter } from '../ui/Dialog'
import { Button } from '../ui/Button'
import { ALL_METHODS, PaymentMethodList, type PaymentMethod } from './PaymentMethodList'
import { PaymentConfirmStep } from './PaymentConfirmStep'

/**
 * Two-step checkout: pick a method, then confirm. Replaces the old
 * one-tap-commits payment dialog. For cash it takes the amount received and
 * shows change due, blocking confirmation until it covers the total; other
 * methods (and "Unpaid — invoice later", which completes as 'pending') go
 * straight to a plain Confirm.
 *
 * Also doubles as the Record-payment dialog for an order already sitting at
 * 'pending' (src/components/workOrders/CheckoutTicket.tsx) — pass
 * `allowPending={false}` to drop "Unpaid — invoice later" from the method
 * list (collecting a debt can't itself leave it unpaid) and `selectTitle` to
 * relabel the first step, rather than carrying a near-duplicate dialog.
 */
export function PaymentDialog({
  open,
  total,
  allowPending = true,
  selectTitle,
  defaultDueDate,
  onClose,
  onConfirm,
}: {
  open: boolean
  total: number
  /** false for the Record-payment flow — a debt can't be settled as still-pending. */
  allowPending?: boolean
  /** Overrides the method-picker step's title (defaults to "Select Payment Method"). */
  selectTitle?: string
  /** Prefill for the due-date field when 'pending' is picked — ignored when allowPending is false. */
  defaultDueDate?: string
  onClose: () => void
  onConfirm: (method: PaymentMethod, amountReceived: number | null, paymentDueDate: string | null) => void
}) {
  const { t } = useTranslation()
  const [method, setMethod] = useState<PaymentMethod | null>(null)
  const [receivedText, setReceivedText] = useState('')
  const [dueDate, setDueDate] = useState('')

  useEffect(() => {
    if (!open) {
      setMethod(null)
      setReceivedText('')
      setDueDate('')
      return
    }
    setDueDate(defaultDueDate ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reseed only on open, same as LineItemDialog's reseed-on-open
  }, [open])

  const methods = allowPending ? ALL_METHODS : ALL_METHODS.filter(m => m !== 'pending')
  const received = receivedText ? parseInt(receivedText, 10) : 0
  const change = received - total
  const cashShort = method === 'cash' && received < total

  const confirm = () => {
    if (!method || cashShort) return
    onConfirm(
      method,
      method === 'cash' && receivedText ? received : null,
      method === 'pending' ? dueDate || null : null
    )
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={method ? t('workOrders.paymentConfirmTitle') : selectTitle ?? t('workOrders.selectPaymentMethodTitle')}
      size="sm"
    >
      {method ? (
        <PaymentConfirmStep
          total={total}
          method={method}
          receivedText={receivedText}
          onReceivedTextChange={setReceivedText}
          change={change}
          dueDate={dueDate}
          onDueDateChange={setDueDate}
        />
      ) : (
        <PaymentMethodList methods={methods} onSelect={setMethod} />
      )}
      <DialogFooter>
        {method ? (
          <>
            <Button variant="ghost" type="button" onClick={() => setMethod(null)}>{t('common.back')}</Button>
            <Button variant="primary" onClick={confirm} disabled={cashShort}>{t('workOrders.confirmPaymentButton')}</Button>
          </>
        ) : (
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
        )}
      </DialogFooter>
    </Dialog>
  )
}
