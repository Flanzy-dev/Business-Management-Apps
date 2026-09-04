import { Banknote, Percent, Receipt, TrendingUp } from 'lucide-react'
import { Card } from '../ui/Card'
import { StatCard } from '../dashboard/StatCard'
import { formatCurrency } from '../../lib/currency'
import type { PnlSummary } from '../../lib/finance'
import { useTranslation } from '../../lib/i18n'

function formatPct(value: number): string {
  return `${value.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`
}

/** The four top-line KPI cards: revenue, expenses, net profit (each vs. the
 *  prior period), and net margin (no prior-period comparison — it's a ratio,
 *  not a total, so "up/down" would be misleading). */
export function PnlKpiRow({
  summary,
  revenueDelta,
  expenseDelta,
  expenseTone,
  profitDelta,
  periodLabel,
  prevLabel,
}: {
  summary: PnlSummary
  revenueDelta: number | null
  expenseDelta: number | null
  // For expenses, an increase is a bad sign — the caller flips the tone (DESIGN.md §5.1).
  expenseTone: 'up' | 'down' | 'neutral' | undefined
  profitDelta: number | null
  periodLabel: string
  prevLabel: string
}) {
  const { t } = useTranslation()

  return (
    <Card padding="md">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title={t('pnlReport.revenueTitle', { period: periodLabel })}
          value={formatCurrency(summary.revenue)}
          icon={Banknote}
          delta={revenueDelta}
          deltaLabel={prevLabel}
        />
        <StatCard
          title={t('pnlReport.expensesTitle', { period: periodLabel })}
          value={formatCurrency(summary.expenses)}
          icon={Receipt}
          delta={expenseDelta}
          deltaTone={expenseTone}
          deltaLabel={prevLabel}
        />
        <StatCard
          title={t('pnlReport.netProfitTitle')}
          value={formatCurrency(summary.netProfit)}
          icon={TrendingUp}
          delta={profitDelta}
          deltaLabel={prevLabel}
        />
        <StatCard
          title={t('pnlReport.netMarginTitle')}
          value={summary.netMarginPct === null ? '—' : formatPct(summary.netMarginPct)}
          icon={Percent}
          hint={t('pnlReport.netMarginHint')}
        />
      </div>
    </Card>
  )
}
