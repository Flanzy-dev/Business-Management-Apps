import { AlertTriangle } from 'lucide-react'
import { chartTheme } from '../../lib/chartTheme'
import { formatCurrency } from '../../lib/currency'
import type { PaymentSplit } from '../../lib/finance'
import { useTranslation } from '../../lib/i18n'

// check uses the neutral fg3 slate deliberately (it's the "neutral" slot);
// identity is never color-alone — every method gets a labeled legend row.
const METHOD_META: Record<PaymentSplit['method'], { labelKey: string; color: string }> = {
  cash: { labelKey: 'paymentCash', color: chartTheme.success },
  qris: { labelKey: 'paymentQris', color: chartTheme.violet },
  card: { labelKey: 'paymentCard', color: chartTheme.info },
  check: { labelKey: 'paymentCheck', color: chartTheme.fg3 },
  pending: { labelKey: 'paymentPending', color: chartTheme.warning },
}

interface PaymentMethodBreakdownProps {
  data: PaymentSplit[]
  className?: string
}

export function PaymentMethodBreakdown({ data, className = '' }: PaymentMethodBreakdownProps) {
  const { t } = useTranslation()
  const label = (method: PaymentSplit['method']) => t(`reportsWidgets.${METHOD_META[method].labelKey}`)
  const segments = data.filter(s => s.amount > 0)
  const pending = data.find(s => s.method === 'pending')
  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex h-3 rounded-radius-full overflow-hidden gap-0.5">
        {segments.map(s => (
          <div
            key={s.method}
            title={`${label(s.method)}: ${formatCurrency(s.amount)}`}
            style={{ width: `${s.sharePct}%`, backgroundColor: METHOD_META[s.method].color }}
          />
        ))}
      </div>

      <div className="space-y-2">
        {data.map(s => (
          <div key={s.method} className="flex items-center gap-3">
            <span
              className="w-2.5 h-2.5 rounded-radius-full shrink-0"
              style={{ backgroundColor: METHOD_META[s.method].color }}
            />
            <span className="text-text-primary flex-1">{label(s.method)}</span>
            <span className="font-mono text-text-secondary text-sm tabular-nums">{t('reportsWidgets.ordersSuffix', { count: s.count })}</span>
            <span className="font-mono text-text-primary tabular-nums w-32 text-right">
              {formatCurrency(s.amount)}
            </span>
            <span className="font-mono text-text-secondary text-sm tabular-nums w-14 text-right">
              {s.sharePct.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>

      {pending && pending.amount > 0 && (
        <div className="flex items-center gap-2 bg-warning/10 border border-warning/30 rounded-radius-sm px-3 py-2">
          <AlertTriangle size={16} className="text-warning shrink-0" />
          <p className="text-sm text-warning">
            {t('reportsWidgets.uncollectedPending', { amount: formatCurrency(pending.amount) })}
          </p>
        </div>
      )}
    </div>
  )
}
