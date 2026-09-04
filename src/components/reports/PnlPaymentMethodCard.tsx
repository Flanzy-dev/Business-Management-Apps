import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card'
import { PaymentMethodBreakdown } from './PaymentMethodBreakdown'
import type { PaymentSplit } from '../../lib/finance'
import { useTranslation } from '../../lib/i18n'

export function PnlPaymentMethodCard({
  periodLabel,
  hasRevenue,
  payments,
}: {
  periodLabel: string
  hasRevenue: boolean
  payments: PaymentSplit[]
}) {
  const { t } = useTranslation()

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('pnlReport.revenueByPaymentMethodTitle', { period: periodLabel })}</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasRevenue ? (
          <p className="text-text-secondary text-center py-12">{t('pnlReport.noCompletedOrders')}</p>
        ) : (
          <PaymentMethodBreakdown data={payments} />
        )}
      </CardContent>
    </Card>
  )
}
