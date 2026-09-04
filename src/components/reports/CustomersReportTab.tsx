import type { CustomerRevenueEntry } from '../../lib/finance'
import type { HeatmapGrid } from '../../lib/heatmap'
import { formatCurrency } from '../../lib/currency'
import { useTranslation } from '../../lib/i18n'
import { Select } from '../ui/Input'
import { CustomerActivityHeatmap } from '../CustomerActivityHeatmap'
import { DonutBreakdown } from './DonutBreakdown'
import { RankedBarChart } from './RankedBarChart'

export interface CustomersReportData {
  topCustomers: CustomerRevenueEntry[]
  customerMix: { label: string; value: number }[]
  availableYears: number[]
  customerActivityGrid: HeatmapGrid
}

/** Reports.tsx's Customers tab: totals, the activity heatmap (with its own
 *  year picker), the customer-mix donut + top-customers bar chart, and the
 *  ranked list. */
export function CustomersReportTab({
  data,
  totalCustomers,
  totalCompanies,
  totalVehicles,
  heatmapYear,
  onHeatmapYearChange,
  ownerDisplayName,
}: {
  data: CustomersReportData
  totalCustomers: number
  totalCompanies: number
  totalVehicles: number
  heatmapYear: number
  onHeatmapYearChange: (year: number) => void
  ownerDisplayName: (name: string) => string
}) {
  const { t } = useTranslation()
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface-card rounded-radius-md p-4">
          <p className="text-caption">{t('reports.totalCustomers')}</p>
          <p className="text-3xl font-bold text-text-primary tabular-nums">{totalCustomers}</p>
        </div>
        <div className="bg-surface-card rounded-radius-md p-4">
          <p className="text-caption">{t('reports.companyAccounts')}</p>
          <p className="text-3xl font-bold text-text-primary tabular-nums">{totalCompanies}</p>
        </div>
        <div className="bg-surface-card rounded-radius-md p-4">
          <p className="text-caption">{t('reports.totalVehicles')}</p>
          <p className="text-3xl font-bold text-text-primary tabular-nums">{totalVehicles}</p>
        </div>
      </div>

      <div className="bg-surface-card rounded-radius-md p-6">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <h2 className="text-card-title text-text-primary">{t('reports.customerActivityHeading', { year: heatmapYear })}</h2>
          <Select value={heatmapYear} onChange={(e) => onHeatmapYearChange(Number(e.target.value))} className="w-auto">
            {data.availableYears.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        </div>
        <CustomerActivityHeatmap grid={data.customerActivityGrid} />
      </div>

      {data.topCustomers.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-surface-card rounded-radius-md p-6">
            <h2 className="text-card-title text-text-primary mb-4">{t('reports.customerMixHeading')}</h2>
            <DonutBreakdown data={data.customerMix} valueFormatter={formatCurrency} />
          </div>
          <div className="bg-surface-card rounded-radius-md p-6">
            <h2 className="text-card-title text-text-primary mb-4">{t('reports.topCustomersChartHeading')}</h2>
            <RankedBarChart data={data.topCustomers.map((c) => ({ label: ownerDisplayName(c.name), value: c.revenue }))} valueFormatter={formatCurrency} />
          </div>
        </div>
      )}

      <div className="bg-surface-card rounded-radius-md p-6">
        <h2 className="text-card-title text-text-primary mb-4">{t('reports.topCustomersHeading')}</h2>
        {data.topCustomers.length === 0 ? (
          <p className="text-text-secondary text-center py-4">{t('reports.noCustomerData')}</p>
        ) : (
          <div className="space-y-2">
            {data.topCustomers.map((c, i) => (
              <div key={`${c.type}:${c.id}`} className="flex justify-between items-center p-3 bg-surface-sunken rounded-radius-sm">
                <div>
                  <span className="text-text-secondary mr-2">#{i + 1}</span>
                  <span className="font-medium text-text-primary">{ownerDisplayName(c.name)}</span>
                  {c.type === 'company' && (
                    <span className="ml-2 text-xs bg-info/20 text-info px-2 py-0.5 rounded-radius-full">{t('reports.fleetBadge')}</span>
                  )}
                </div>
                <div className="text-right">
                  <span className="font-medium text-text-primary tabular-nums">{formatCurrency(c.revenue)}</span>
                  <span className="ml-3 text-text-secondary text-sm tabular-nums">{t('reports.ordersSuffix', { count: c.visits })}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
