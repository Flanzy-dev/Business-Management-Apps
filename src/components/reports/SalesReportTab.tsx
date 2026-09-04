import type { WorkOrder } from '../../store/workOrderStore'
import type { MonthlySalesPoint, PaymentSplit } from '../../lib/finance'
import { formatCurrency } from '../../lib/currency'
import { formatDate } from '../../lib/dates'
import { useTranslation } from '../../lib/i18n'
import { SalesTrendChart } from './SalesTrendChart'
import { PaymentMethodBreakdown } from './PaymentMethodBreakdown'

export interface SalesReportData {
  totalRevenue: number
  totalServices: number
  avgTicket: number
  salesTrend: MonthlySalesPoint[]
  paymentSplit: PaymentSplit[]
}

/** Reports.tsx's Sales tab: revenue/services/avg-ticket tiles, trend chart,
 *  payment split, and the period's most recent orders. */
export function SalesReportTab({
  data,
  periodOrders,
  periodLabel,
  getOwnerName,
}: {
  data: SalesReportData
  periodOrders: WorkOrder[]
  periodLabel: string
  getOwnerName: (vehicleId: string) => string
}) {
  const { t } = useTranslation()
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface-card rounded-radius-md p-4">
          <p className="text-caption">{t('reports.revenueSuffix', { period: periodLabel })}</p>
          <p className="text-3xl font-bold text-text-primary tabular-nums">{formatCurrency(data.totalRevenue)}</p>
        </div>
        <div className="bg-surface-card rounded-radius-md p-4">
          <p className="text-caption">{t('reports.servicesCompleted')}</p>
          <p className="text-3xl font-bold text-text-primary tabular-nums">{data.totalServices}</p>
        </div>
        <div className="bg-surface-card rounded-radius-md p-4">
          <p className="text-caption">{t('reports.avgTicket')}</p>
          <p className="text-3xl font-bold text-text-primary tabular-nums">{formatCurrency(data.avgTicket)}</p>
        </div>
      </div>

      <div className="bg-surface-card rounded-radius-md p-6">
        <h2 className="text-card-title text-text-primary mb-4">{t('reports.salesTrendHeading')}</h2>
        <SalesTrendChart data={data.salesTrend} revenueLabel={t('reports.revenueLegend')} orderCountLabel={t('reports.orderCountLegend')} />
      </div>

      <div className="bg-surface-card rounded-radius-md p-6">
        <h2 className="text-card-title text-text-primary mb-4">{t('reports.paymentSplitHeading', { period: periodLabel })}</h2>
        <PaymentMethodBreakdown data={data.paymentSplit} />
      </div>

      <div className="bg-surface-card rounded-radius-md p-6">
        <h2 className="text-card-title text-text-primary mb-4">{t('reports.recentOrdersHeading')}</h2>
        {periodOrders.length === 0 ? (
          <p className="text-text-secondary text-center py-4">{t('reports.noOrdersInPeriod')}</p>
        ) : (
          <div className="space-y-2">
            {periodOrders.slice(0, 10).map((wo) => (
              <div key={wo.id} className="flex justify-between items-center p-3 bg-surface-sunken rounded-radius-sm">
                <div>
                  <span className="font-mono text-sm text-text-primary">#{wo.orderNumber}</span>
                  <span className="ml-3 text-text-primary">{getOwnerName(wo.vehicleId)}</span>
                </div>
                <div className="text-right">
                  <span className="font-medium text-text-primary tabular-nums">{formatCurrency(wo.total)}</span>
                  <span className="ml-3 text-caption tabular-nums">{formatDate(wo.completedAt || wo.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
