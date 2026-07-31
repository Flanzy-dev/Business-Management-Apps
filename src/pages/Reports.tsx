import { useState } from 'react'
import { useWorkOrderStore } from '../store/workOrderStore'
import { useCustomerStore } from '../store/customerStore'
import { useCompanyStore } from '../store/companyStore'
import { useVehicleStore } from '../store/vehicleStore'
import { useWorkerStore } from '../store/workerStore'
import { useStockLotStore } from '../store/stockLotStore'
import { useStockMovementStore } from '../store/stockMovementStore'
import { useProductStock } from '../hooks/useProductStock'
import { formatCurrency } from '../lib/currency'
import { productCategoryLabel } from '../lib/entities'
import { chartTheme } from '../lib/chartTheme'
import { Period, getPeriodRange } from '../lib/dates'
import {
  filterCompletedOrders,
  resolveOwnerInfo,
  computeTopCustomers,
  computeCustomerRevenueMix,
  computeWorkerPerformance,
  computeTopProductsByValue,
  computeInventoryValueByCategory,
  productInventoryValue,
  computeMonthlySalesTrend,
  computePaymentSplit,
  computeDailyCustomerCounts,
  orderDate,
} from '../lib/finance'
import { buildHeatmapGrid } from '../lib/heatmap'
import { lotValueByProduct } from '../lib/inventoryCosting'
import { hydrateLots } from '../lib/stockLedger'
import { PnlReport } from '../components/reports/PnlReport'
import { SalesTrendChart } from '../components/reports/SalesTrendChart'
import { PaymentMethodBreakdown } from '../components/reports/PaymentMethodBreakdown'
import { DonutBreakdown } from '../components/reports/DonutBreakdown'
import { RankedBarChart } from '../components/reports/RankedBarChart'
import { CustomerActivityHeatmap } from '../components/CustomerActivityHeatmap'
import { PageHeader } from '../components/ui/PageHeader'
import { Select } from '../components/ui/Input'
import { Tabs } from '../components/ui/Tabs'
import { useTranslation } from '../lib/i18n'

type ReportType = 'sales' | 'pnl' | 'customers' | 'workers' | 'inventory'

export default function Reports() {
  const { t } = useTranslation()
  const { workOrders } = useWorkOrderStore()
  const { customers } = useCustomerStore()
  const { companies } = useCompanyStore()
  const { vehicles } = useVehicleStore()
  const { workers } = useWorkerStore()
  const products = useProductStock()
  const stockLots = useStockLotStore(s => s.stockLots)
  const movements = useStockMovementStore(s => s.movements)

  const [reportType, setReportType] = useState<ReportType>('sales')
  const [period, setPeriod] = useState<Period>('month')
  const currentYear = new Date().getFullYear()
  const [heatmapYear, setHeatmapYear] = useState(currentYear)

  const completedOrders = workOrders.filter(wo => wo.status === 'completed')
  const periodOrders = filterCompletedOrders(workOrders, getPeriodRange(period))

  // Sales metrics
  const totalRevenue = periodOrders.reduce((sum, wo) => sum + wo.total, 0)
  const totalServices = periodOrders.length
  const avgTicket = totalServices > 0 ? totalRevenue / totalServices : 0
  const salesTrend = computeMonthlySalesTrend(completedOrders)
  const paymentSplit = computePaymentSplit(periodOrders)

  // Customer metrics
  const getOwnerInfo = (vehicleId: string) => resolveOwnerInfo(vehicleId, vehicles, customers, companies)
  const ownerDisplayName = (name: string) => (name === 'Unknown' ? t('reports.unknown') : name === 'No owner' ? t('reports.noOwner') : name)

  const topCustomers = computeTopCustomers(completedOrders, vehicles, customers, companies)
  const customerMix = computeCustomerRevenueMix(completedOrders, vehicles).map(entry => ({
    label: entry.ownerType === 'customer' ? t('reports.individualLabel') : t('reports.companyFleetLabel'),
    value: entry.revenue,
  }))
  const availableYears = [...new Set([currentYear, ...completedOrders.map(wo => orderDate(wo).getFullYear())])]
    .sort((a, b) => b - a)
  const customerActivityGrid = buildHeatmapGrid(computeDailyCustomerCounts(completedOrders, vehicles), heatmapYear)

  // Worker metrics
  const workerStats = computeWorkerPerformance(periodOrders, workers)

  // Inventory metrics — valued from the FIFO lots each product's stock came in
  // on, so mixed-cost stock isn't flattened to one price (lib/inventoryCosting.ts).
  const lowStock = products.filter(p => p.qtyOnHand <= p.reorderPoint)
  const lotValueByProductId = lotValueByProduct(hydrateLots(stockLots, movements))
  const inventoryValue = products.reduce((sum, p) => sum + productInventoryValue(p, lotValueByProductId), 0)
  const topProductsByValue = computeTopProductsByValue(products, lotValueByProductId)
  const inventoryByCategory = computeInventoryValueByCategory(products, lotValueByProductId).map(entry => ({
    label: productCategoryLabel(entry.category),
    value: entry.amount,
  }))

  const periodLabel = {
    day: t('reports.periodLabelDay'),
    week: t('reports.periodLabelWeek'),
    month: t('reports.periodLabelMonth'),
    year: t('reports.periodLabelYear'),
  }[period]

  const periodButtonLabel = {
    day: t('reports.periodDay'),
    week: t('reports.periodWeek'),
    month: t('reports.periodMonth'),
    year: t('reports.periodYear'),
  }

  return (
    <div>
      <PageHeader title={t('reports.title')} />

      {/* Report Type Tabs */}
      <Tabs
        className="mb-6"
        variant="pill"
        value={reportType}
        onChange={v => setReportType(v as ReportType)}
        tabs={[
          { value: 'sales', label: t('reports.tabSales') },
          { value: 'pnl', label: t('reports.tabPnl') },
          { value: 'customers', label: t('reports.tabCustomers') },
          { value: 'workers', label: t('reports.tabWorkers') },
          { value: 'inventory', label: t('reports.tabInventory') },
        ]}
      />

      {/* Period Filter (for sales, pnl, workers) */}
      {['sales', 'pnl', 'workers'].includes(reportType) && (
        <div className="flex gap-2 mb-6">
          {(['day', 'week', 'month', 'year'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 rounded-radius-sm transition-colors ${
                period === p ? 'bg-accent/20 text-accent' : 'bg-surface-sunken text-text-secondary hover:text-text-primary'
              }`}
            >
              {periodButtonLabel[p]}
            </button>
          ))}
        </div>
      )}

      {/* Sales Report */}
      {reportType === 'sales' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-surface-card rounded-radius-md p-4">
              <p className="text-caption">{t('reports.revenueSuffix', { period: periodLabel })}</p>
              <p className="text-3xl font-bold text-text-primary tabular-nums">{formatCurrency(totalRevenue)}</p>
            </div>
            <div className="bg-surface-card rounded-radius-md p-4">
              <p className="text-caption">{t('reports.servicesCompleted')}</p>
              <p className="text-3xl font-bold text-text-primary tabular-nums">{totalServices}</p>
            </div>
            <div className="bg-surface-card rounded-radius-md p-4">
              <p className="text-caption">{t('reports.avgTicket')}</p>
              <p className="text-3xl font-bold text-text-primary tabular-nums">{formatCurrency(avgTicket)}</p>
            </div>
          </div>

          <div className="bg-surface-card rounded-radius-md p-6">
            <h2 className="text-card-title text-text-primary mb-4">{t('reports.salesTrendHeading')}</h2>
            <SalesTrendChart
              data={salesTrend}
              revenueLabel={t('reports.revenueLegend')}
              orderCountLabel={t('reports.orderCountLegend')}
            />
          </div>

          <div className="bg-surface-card rounded-radius-md p-6">
            <h2 className="text-card-title text-text-primary mb-4">{t('reports.paymentSplitHeading', { period: periodLabel })}</h2>
            <PaymentMethodBreakdown data={paymentSplit} />
          </div>

          <div className="bg-surface-card rounded-radius-md p-6">
            <h2 className="text-card-title text-text-primary mb-4">{t('reports.recentOrdersHeading')}</h2>
            {periodOrders.length === 0 ? (
              <p className="text-text-secondary text-center py-4">{t('reports.noOrdersInPeriod')}</p>
            ) : (
              <div className="space-y-2">
                {periodOrders.slice(0, 10).map(wo => (
                  <div key={wo.id} className="flex justify-between items-center p-3 bg-surface-sunken rounded-radius-sm">
                    <div>
                      <span className="font-mono text-sm text-text-primary">#{wo.orderNumber}</span>
                      <span className="ml-3 text-text-primary">{ownerDisplayName(getOwnerInfo(wo.vehicleId).name)}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-medium text-text-primary tabular-nums">{formatCurrency(wo.total)}</span>
                      <span className="ml-3 text-caption tabular-nums">
                        {new Date(wo.completedAt || wo.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* P&L Report */}
      {reportType === 'pnl' && <PnlReport period={period} />}

      {/* Customers Report */}
      {reportType === 'customers' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-surface-card rounded-radius-md p-4">
              <p className="text-caption">{t('reports.totalCustomers')}</p>
              <p className="text-3xl font-bold text-text-primary tabular-nums">{customers.length}</p>
            </div>
            <div className="bg-surface-card rounded-radius-md p-4">
              <p className="text-caption">{t('reports.companyAccounts')}</p>
              <p className="text-3xl font-bold text-text-primary tabular-nums">{companies.length}</p>
            </div>
            <div className="bg-surface-card rounded-radius-md p-4">
              <p className="text-caption">{t('reports.totalVehicles')}</p>
              <p className="text-3xl font-bold text-text-primary tabular-nums">{vehicles.length}</p>
            </div>
          </div>

          <div className="bg-surface-card rounded-radius-md p-6">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
              <h2 className="text-card-title text-text-primary">{t('reports.customerActivityHeading', { year: heatmapYear })}</h2>
              <Select
                value={heatmapYear}
                onChange={(e) => setHeatmapYear(Number(e.target.value))}
                className="w-auto"
              >
                {availableYears.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </Select>
            </div>
            <CustomerActivityHeatmap grid={customerActivityGrid} />
          </div>

          {topCustomers.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-surface-card rounded-radius-md p-6">
                <h2 className="text-card-title text-text-primary mb-4">{t('reports.customerMixHeading')}</h2>
                <DonutBreakdown data={customerMix} valueFormatter={formatCurrency} />
              </div>
              <div className="bg-surface-card rounded-radius-md p-6">
                <h2 className="text-card-title text-text-primary mb-4">{t('reports.topCustomersChartHeading')}</h2>
                <RankedBarChart
                  data={topCustomers.map(c => ({ label: ownerDisplayName(c.name), value: c.revenue }))}
                  valueFormatter={formatCurrency}
                />
              </div>
            </div>
          )}

          <div className="bg-surface-card rounded-radius-md p-6">
            <h2 className="text-card-title text-text-primary mb-4">{t('reports.topCustomersHeading')}</h2>
            {topCustomers.length === 0 ? (
              <p className="text-text-secondary text-center py-4">{t('reports.noCustomerData')}</p>
            ) : (
              <div className="space-y-2">
                {topCustomers.map((c, i) => (
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
      )}

      {/* Workers Report */}
      {reportType === 'workers' && (
        <div className="space-y-6">
          {workerStats.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-surface-card rounded-radius-md p-6">
                <h2 className="text-card-title text-text-primary mb-4">{t('reports.workerRevenueHeading')}</h2>
                <RankedBarChart
                  data={workerStats.map(w => ({ label: w.name, value: w.revenue }))}
                  valueFormatter={formatCurrency}
                />
              </div>
              <div className="bg-surface-card rounded-radius-md p-6">
                <h2 className="text-card-title text-text-primary mb-4">{t('reports.workerJobsHeading')}</h2>
                <RankedBarChart
                  data={workerStats.map(w => ({ label: w.name, value: w.jobCount }))}
                  barColor={chartTheme.info}
                />
              </div>
            </div>
          )}

          <div className="bg-surface-card rounded-radius-md p-6">
            <h2 className="text-card-title text-text-primary mb-4">{t('reports.workerPerformanceHeading', { period: periodLabel })}</h2>
            {workerStats.length === 0 ? (
              <p className="text-text-secondary text-center py-4">{t('reports.noWorkersYet')}</p>
            ) : (
              <div className="space-y-2">
                {workerStats.map((w, i) => (
                  <div key={w.id} className="flex justify-between items-center p-3 bg-surface-sunken rounded-radius-sm">
                    <div className="flex items-center gap-3">
                      <span className="text-text-secondary">#{i + 1}</span>
                      <div>
                        <span className="font-medium text-text-primary">{w.name}</span>
                        {!w.isActive && (
                          <span className="ml-2 text-xs bg-surface-canvas text-text-secondary px-2 py-0.5 rounded-radius-full">{t('reports.inactiveBadge')}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-medium text-text-primary tabular-nums">{formatCurrency(w.revenue)}</span>
                      <span className="ml-3 text-text-secondary text-sm tabular-nums">{t('reports.servicesSuffix', { count: w.jobCount })}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Inventory Report */}
      {reportType === 'inventory' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-surface-card rounded-radius-md p-4">
              <p className="text-caption">{t('reports.totalProducts')}</p>
              <p className="text-3xl font-bold text-text-primary tabular-nums">{products.length}</p>
            </div>
            <div className="bg-surface-card rounded-radius-md p-4">
              <p className="text-caption">{t('reports.inventoryValueCost')}</p>
              <p className="text-3xl font-bold text-text-primary tabular-nums">{formatCurrency(inventoryValue)}</p>
            </div>
            <div className={`bg-surface-card rounded-radius-md p-4 ${lowStock.length > 0 ? 'border-l-4 border-warning' : ''}`}>
              <p className="text-caption">{t('reports.lowStockItems')}</p>
              <p className={`text-3xl font-bold tabular-nums ${lowStock.length > 0 ? 'text-warning' : 'text-text-primary'}`}>
                {lowStock.length}
              </p>
            </div>
          </div>

          {lowStock.length > 0 && (
            <div className="bg-warning/10 rounded-radius-md p-6 border border-warning/30">
              <h2 className="text-card-title text-warning mb-4">{t('reports.lowStockItems')}</h2>
              <div className="space-y-2">
                {lowStock.map(p => (
                  <div key={p.id} className="flex justify-between items-center p-3 bg-surface-card rounded-radius-sm">
                    <div>
                      <span className="font-medium text-text-primary">{p.name}</span>
                      <span className="ml-2 text-text-secondary text-sm">{productCategoryLabel(p.category)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-warning font-bold tabular-nums">{p.qtyOnHand}</span>
                      <span className="text-text-secondary text-sm ml-1">/ {p.reorderPoint} {p.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {products.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-surface-card rounded-radius-md p-6">
                <h2 className="text-card-title text-text-primary mb-4">{t('reports.inventoryByCategoryHeading')}</h2>
                <DonutBreakdown data={inventoryByCategory} valueFormatter={formatCurrency} />
              </div>
              <div className="bg-surface-card rounded-radius-md p-6">
                <h2 className="text-card-title text-text-primary mb-4">{t('reports.topProductsChartHeading')}</h2>
                <RankedBarChart
                  data={topProductsByValue.map(p => ({ label: p.name, value: p.value }))}
                  valueFormatter={formatCurrency}
                />
              </div>
            </div>
          )}

          <div className="bg-surface-card rounded-radius-md p-6">
            <h2 className="text-card-title text-text-primary mb-4">{t('reports.allProductsByValueHeading')}</h2>
            {products.length === 0 ? (
              <p className="text-text-secondary text-center py-4">{t('reports.noProductsYet')}</p>
            ) : (
              <div className="space-y-2">
                {[...products]
                  .sort(
                    (a, b) =>
                      productInventoryValue(b, lotValueByProductId) -
                      productInventoryValue(a, lotValueByProductId)
                  )
                  .slice(0, 10)
                  .map(p => (
                    <div key={p.id} className="flex justify-between items-center p-3 bg-surface-sunken rounded-radius-sm">
                      <div>
                        <span className="font-medium text-text-primary">{p.name}</span>
                        <span className="ml-2 text-text-secondary text-sm">{p.qtyOnHand} {p.unit}</span>
                      </div>
                      <span className="font-medium text-text-primary tabular-nums">
                        {formatCurrency(productInventoryValue(p, lotValueByProductId))}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
