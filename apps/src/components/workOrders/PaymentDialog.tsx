import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from '../../lib/i18n'
import { canConfirmPayment, changeDue, paymentResult, type PaymentFormState } from '../../lib/orders/paymentForm'
import { Dialog, DialogFooter } from '../ui/Dialog'
import { Button } from '../ui/Button'
import { ALL_METHODS, PaymentMethodList, type PaymentMethod } from './PaymentMethodList'
import { PaymentConfirmStep } from './PaymentConfirmStep'

/**
 * Checkout on one screen: the method (cash preselected), the total, and the
 * one field that method needs. Enter confirms. For cash the amount received
 * is optional — empty means paid exactly — so the usual case is Charge, then
 * Enter. A typed amount shows change due and must cover the total. "Unpaid —
 * invoice later" completes the order as 'pending' with a due date. The rules
 * live in src/lib/orders/paymentForm.ts.
 *
 * This used to be two steps (pick a method, then a confirm screen that for
 * QRIS, card and check only repeated the total), with nothing preselected and
 * Enter doing nothing.
 *
 * Also doubles as the Record-payment dialog for an order already sitting at
 * 'pending' (src/components/workOrders/CheckoutTicket.tsx) — pass
 * `allowPending={false}` to drop "Unpaid — invoice later" from the methods
 * (collecting a debt can't itself leave it unpaid) and `selectTitle` to
 * relabel the dialog, rather than carrying a near-duplicate dialog.
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
  /** Overrides the dialog title (defaults to "Confirm payment"). */
  selectTitle?: string
  /** Prefill for the due-date field when 'pending' is picked — ignored when allowPending is false. */
  defaultDueDate?: string
  onClose: () => void
  onConfirm: (method: PaymentMethod, amountReceived: number | null, paymentDueDate: string | null) => void
}) {
  const { t } = useTranslation()
  const [form, setForm] = useState<PaymentFormState>({ method: 'cash', receivedText: '', dueDate: '' })

  useEffect(() => {
    if (open) setForm({ method: 'cash', receivedText: '', dueDate: defaultDueDate ?? '' })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reseed only on open, same as LineItemDialog's reseed-on-open
  }, [open])

  const methods = allowPending ? ALL_METHODS : ALL_METHODS.filter(m => m !== 'pending')
  const canConfirm = canConfirmPayment(form, total)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!canConfirm) return
    const result = paymentResult(form)
    onConfirm(result.method, result.amountReceived, result.paymentDueDate)
  }

  return (
    <Dialog closeOnScrimClick={false} open={open} onClose={onClose} title={selectTitle ?? t('workOrders.paymentConfirmTitle')} size="sm">
      <form onSubmit={submit} className="space-y-4">
        <PaymentMethodList methods={methods} value={form.method} onChange={method => setForm(f => ({ ...f, method }))} />
        <PaymentConfirmStep
          total={total}
          method={form.method}
          receivedText={form.receivedText}
          onReceivedTextChange={receivedText => setForm(f => ({ ...f, receivedText }))}
          change={changeDue(form, total)}
          dueDate={form.dueDate}
          onDueDateChange={dueDate => setForm(f => ({ ...f, dueDate }))}
        />
        <DialogFooter>
          <Button variant="ghost" type="button" onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" type="submit" disabled={!canConfirm}>{t('workOrders.confirmPaymentButton')}</Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
