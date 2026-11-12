import { useRef, type KeyboardEvent } from 'react'
import { useTranslation } from '../../lib/i18n'
import type { PaymentMethod } from '../../lib/orders/paymentForm'
import { PAID_METHOD_KEYS } from '../../lib/orders/paymentMethods'

export type { PaymentMethod }

export const METHOD_KEYS: Record<PaymentMethod, string> = {
  ...PAID_METHOD_KEYS,
  pending: 'unpaidInvoiceLater',
}

export const ALL_METHODS: readonly PaymentMethod[] = ['cash', 'qris', 'card', 'check', 'pending']

/** How the customer is paying, as a row of choices with one always picked —
 *  part of the payment screen, not a step of its own. */
export function PaymentMethodList({
  methods,
  value,
  onChange,
}: {
  methods: readonly PaymentMethod[]
  value: PaymentMethod
  onChange: (method: PaymentMethod) => void
}) {
  const { t } = useTranslation()
  const buttons = useRef<(HTMLButtonElement | null)[]>([])

  // WAI-ARIA radio group: Tab reaches only the picked method; the arrow keys
  // move the pick (and focus) to the previous/next one, wrapping around.
  // Enter confirms the payment: the dialog opens with focus on the picked
  // method (cash), and a button's own Enter would only click it again, so
  // "Charge, then Enter" would do nothing. Submitting the enclosing form
  // runs the same checks as the Confirm button.
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      e.currentTarget.form?.requestSubmit()
      return
    }
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!step) return
    e.preventDefault()
    const next = (index + step + methods.length) % methods.length
    onChange(methods[next])
    buttons.current[next]?.focus()
  }

  return (
    <div role="radiogroup" aria-label={t('workOrders.selectPaymentMethodTitle')} className="grid grid-cols-2 gap-2">
      {methods.map((m, index) => {
        const selected = m === value
        return (
          <button
            key={m}
            ref={(el) => { buttons.current[index] = el }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onKeyDown={(e) => onKeyDown(e, index)}
            onClick={() => onChange(m)}
            className={`min-h-[44px] px-3 py-2 rounded-radius-sm border text-left text-sm transition-colors focus-ring ${
              // "Unpaid" spans the row: it's the odd one out, not a way to pay.
              m === 'pending' ? 'col-span-2' : ''
            } ${
              selected
                ? 'border-accent bg-accent-muted text-fg-1 font-medium'
                : 'border-border-subtle bg-surface-sunken text-text-primary hover:border-accent'
            }`}
          >
            {t(`workOrders.${METHOD_KEYS[m]}`)}
          </button>
        )
      })}
    </div>
  )
}
