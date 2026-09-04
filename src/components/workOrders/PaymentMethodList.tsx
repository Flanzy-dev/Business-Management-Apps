import { WorkOrder } from '../../store/workOrderStore'
import { useTranslation } from '../../lib/i18n'

export type PaymentMethod = WorkOrder['paymentMethod']

export const METHOD_KEYS: Record<PaymentMethod, string> = {
  cash: 'paymentCash',
  qris: 'paymentQris',
  card: 'paymentCard',
  check: 'paymentCheck',
  pending: 'unpaidInvoiceLater',
}

export const ALL_METHODS: readonly PaymentMethod[] = ['cash', 'qris', 'card', 'check', 'pending']

/** Step one: pick how the customer is paying. */
export function PaymentMethodList({ methods, onSelect }: { methods: readonly PaymentMethod[]; onSelect: (method: PaymentMethod) => void }) {
  const { t } = useTranslation()

  return (
    <div className="space-y-2">
      {methods.map(m => (
        <button
          key={m}
          onClick={() => onSelect(m)}
          className="w-full min-h-[44px] p-3 bg-surface-sunken border border-border-subtle rounded-radius-sm hover:border-accent text-left text-text-primary transition-colors focus-ring"
        >
          {t(`workOrders.${METHOD_KEYS[m]}`)}
        </button>
      ))}
    </div>
  )
}
