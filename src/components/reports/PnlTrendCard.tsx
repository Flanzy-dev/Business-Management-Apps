import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card'
import { RevenueExpenseTrendChart } from './RevenueExpenseTrendChart'
import type { MonthlyPnlPoint } from '../../lib/finance'
import { useTranslation } from '../../lib/i18n'

/** Revenue vs. expenses over the trailing 12 months — always the full trend,
 *  independent of the period picker driving the rest of this tab. */
export function PnlTrendCard({ trend }: { trend: MonthlyPnlPoint[] }) {
  const { t } = useTranslation()
  const trendHasData = trend.some(p => p.revenue !== 0 || p.expenses !== 0)

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>{t('pnlReport.revenueVsExpensesTitle')}</CardTitle>
        <p className="text-caption">{t('pnlReport.last12MonthsCaption')}</p>
      </CardHeader>
      <CardContent>
        {trendHasData ? (
          <RevenueExpenseTrendChart data={trend} />
        ) : (
          <p className="text-text-secondary text-center py-12">{t('pnlReport.noFinancialActivity')}</p>
        )}
      </CardContent>
    </Card>
  )
}
