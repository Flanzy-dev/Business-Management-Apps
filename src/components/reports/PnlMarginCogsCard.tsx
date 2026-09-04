import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card'
import { formatCurrency } from '../../lib/currency'
import type { CogsBreakdown } from '../../lib/finance'
import { useTranslation } from '../../lib/i18n'

function formatPct(value: number): string {
  return `${value.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`
}

/** Parts vs. service revenue, cost of goods sold, and gross margin on parts —
 *  empty (rather than all-zero) once the period has no completed orders. */
export function PnlMarginCogsCard({ hasCompletedOrders, cogs }: { hasCompletedOrders: boolean; cogs: CogsBreakdown }) {
  const { t } = useTranslation()
  const itemRevenue = cogs.productRevenue + cogs.serviceRevenue

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('pnlReport.marginCogsTitle')}</CardTitle>
        <p className="text-caption">{t('pnlReport.marginCogsCaption')}</p>
      </CardHeader>
      <CardContent>
        {!hasCompletedOrders ? (
          <p className="text-text-secondary text-center py-12">{t('pnlReport.noCompletedOrders')}</p>
        ) : (
          <div className="space-y-4">
            {itemRevenue > 0 && (
              <div className="flex h-2 rounded-radius-full overflow-hidden gap-0.5">
                <div className="bg-info" style={{ width: `${(cogs.productRevenue / itemRevenue) * 100}%` }} />
                <div className="bg-accent" style={{ width: `${(cogs.serviceRevenue / itemRevenue) * 100}%` }} />
              </div>
            )}
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-radius-full bg-info shrink-0" />
                <span className="text-text-primary flex-1">{t('pnlReport.partsRevenue')}</span>
                <span className="font-mono text-text-primary tabular-nums">{formatCurrency(cogs.productRevenue)}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-radius-full bg-accent shrink-0" />
                <span className="text-text-primary flex-1">{t('pnlReport.serviceRevenue')}</span>
                <span className="font-mono text-text-primary tabular-nums">{formatCurrency(cogs.serviceRevenue)}</span>
              </div>
            </div>
            <div className="border-t border-border-subtle pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">{t('pnlReport.cogsEstimate')}</span>
                <span className="font-mono text-danger tabular-nums">−{formatCurrency(cogs.cogs)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">{t('pnlReport.grossProfitOnParts')}</span>
                <span className="font-mono text-text-primary tabular-nums">{formatCurrency(cogs.grossProfitOnParts)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">{t('pnlReport.grossMarginParts')}</span>
                <span className="font-mono text-text-primary tabular-nums">
                  {cogs.grossMarginPct === null ? '—' : formatPct(cogs.grossMarginPct)}
                </span>
              </div>
            </div>
            {cogs.unknownProductRevenue > 0 && (
              <p className="text-xs text-text-secondary">
                {t('pnlReport.unknownProductRevenueNote', { amount: formatCurrency(cogs.unknownProductRevenue) })}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
