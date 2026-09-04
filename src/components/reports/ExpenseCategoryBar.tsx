import { RankedBarChart } from './RankedBarChart'
import { chartTheme } from '../../lib/chartTheme'
import { formatCompactIDR, formatCurrency } from '../../lib/currency'
import type { CategoryTotal } from '../../lib/finance'
import { useTranslation } from '../../lib/i18n'

interface ExpenseCategoryBarProps {
  data: CategoryTotal[]
  className?: string
}

// Was a near-duplicate of RankedBarChart (same layout="vertical" BarChart,
// same wrapper height formula, same barSize/radius) — now a thin adapter from
// CategoryTotal[] to RankedBarChart's generic {label, value, meta} shape, with
// the one thing that made a full duplicate necessary: the tooltip needs each
// row's own sharePct, not just its amount.
export function ExpenseCategoryBar({ data, className = '' }: ExpenseCategoryBarProps) {
  const { t } = useTranslation()
  return (
    <RankedBarChart
      data={data.map((d) => ({ label: d.category, value: d.amount, meta: d.sharePct }))}
      valueFormatter={formatCompactIDR}
      tooltipFormatter={(value, row) => {
        const share = row.meta as number | undefined
        const amount = formatCurrency(value)
        return share === undefined ? amount : `${amount} · ${share.toFixed(1)}%`
      }}
      barName={t('reportsWidgets.amount')}
      barColor={chartTheme.danger}
      className={className}
    />
  )
}
