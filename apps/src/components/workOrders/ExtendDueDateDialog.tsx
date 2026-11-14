import { useEffect, useState, type FormEvent } from 'react'
import { useWorkOrderStore, type WorkOrder } from '../../store/workOrderStore'
import { useToastStore } from '../../store/uiStores'
import { applyDueDateExtension } from '../../lib/orders/orderLifecycle'
import { defaultPaymentDueDate } from '../../lib/orders/receivables'
import { dayKeyLocal } from '../../lib/format/dateKeys'
import { formatDate } from '../../lib/format/dates'
import { orderLabel } from '../../lib/format/entities'
import { useTranslation } from '../../lib/i18n'
import { Dialog, DialogFooter } from '../ui/Dialog'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'

/** The "+7 / +14 / +30 days" shortcuts — the terms a shop actually grants. */
const QUICK_EXTENSION_DAYS = [7, 14, 30]

/**
 * Give an unpaid invoice more time (admin only — the caller gates it, see
 * permissions.ts's canExtendPaymentDue). The rules live in orderLifecycle.ts's
 * applyDueDateExtension; this only collects the date. The shortcuts count from
 * the current due date, or from today when that has already passed or was
 * never set, so "+14 days" on an overdue invoice means two weeks from now.
 */
export function ExtendDueDateDialog({ open, order, onClose }: { open: boolean; order: WorkOrder | null; onClose: () => void }) {
  const { t } = useTranslation()
  const updateWorkOrder = useWorkOrderStore(s => s.updateWorkOrder)
  const showToast = useToastStore(s => s.show)
  const [date, setDate] = useState('')

  useEffect(() => {
    if (open) setDate('')
  }, [open, order?.id])

  if (!order) return null

  const today = new Date()
  const todayKey = dayKeyLocal(today)
  const current = order.paymentDueDate ?? null
  // YYYY-MM-DD compares correctly as plain text.
  const base = current && current > todayKey ? new Date(`${current}T00:00:00`) : today

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const result = applyDueDateExtension(order, date, new Date())
    if (!result.ok) {
      showToast({ tone: 'danger', title: result.reason })
      return
    }
    updateWorkOrder(order.id, result.patch)
    showToast({ tone: 'success', title: t('receivables.extendDueSaved', { date: formatDate(date) }) })
    onClose()
  }

  return (
    <Dialog closeOnScrimClick={false} open={open} onClose={onClose} title={t('receivables.extendDueTitle')} size="sm">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <p className="text-sm text-fg-1">{orderLabel(order.orderNumber, order.orderNumberSuffix)}</p>
          <p className="text-caption">{current ? t('receivables.extendDueCurrent', { date: formatDate(current) }) : t('receivables.extendDueNone')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {QUICK_EXTENSION_DAYS.map(days => (
            <Button
              key={days}
              variant="secondary"
              size="sm"
              type="button"
              onClick={() => setDate(defaultPaymentDueDate(base, days))}
            >
              {t('receivables.extendDueQuick', { days })}
            </Button>
          ))}
        </div>
        <Input
          type="date"
          label={t('receivables.extendDueNewLabel')}
          value={date}
          min={current && current > todayKey ? current : todayKey}
          onChange={e => setDate(e.target.value)}
        />
        <DialogFooter>
          <Button variant="ghost" type="button" onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" type="submit" disabled={!date}>{t('common.save')}</Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
