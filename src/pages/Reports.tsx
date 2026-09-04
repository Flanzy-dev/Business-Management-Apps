import { useMemo, useState } from 'react'
import { useWorkOrderStore } from '../store/workOrderStore'
import { useCustomerStore } from '../store/customerStore'
import { useCompanyStore } from '../store/companyStore'
import { useVehicleStore } from '../store/vehicleStore'
import { useWorkerStore } from '../store/workerStore'
import { useProductStock } from '../hooks/useProductStock'
import { useInventoryValuation } from '../hooks/useInventoryValuation'
import { productCategoryLabel } from '../lib/entities'
import { Period, getPeriodRange, getPreviousPeriodRange } from '../lib/dates'
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
import { isLowStock } from '../lib/stockLedger'
import { PnlReport } from '../components/reports/PnlReport'
import { SalesReportTab } from '../components/reports/SalesReportTab'
import { CustomersReportTab } from '../components/reports/CustomersReportTab'
import { WorkersReportTab } from '../components/reports/WorkersReportTab'
import { InventoryReportTab } from '../components/reports/InventoryReportTab'
import { PageHeader } from '../components/ui/PageHeader'
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
  const { valueByProductId: lotValueByProductId } = useInventoryValuation()

  const [reportType, setReportType] = useState<ReportType>('sales')
  const [period, setPeriod] = useState<Period>('month')
  const currentYear = new Date().getFullYear()
  const [heatmapYear, setHeatmapYear] = useState(currentYear)

  // Shared across more than one tab, so kept outside the per-tab gates below
  // — still cheap O(n) filters, unlike the per-tab derivations they feed.
  const completedOrders = useMemo(() => workOrders.filter(wo => wo.status === 'completed'), [workOrders])
  // Computed once here and passed down to PnlReport (which used to call
  // getPeriodRange(period) again on its own, independently — two `new Date()`
  // calls a moment apart that could in principle straddle a period boundary
  // and disagree on what "now" was for the same render).
  const range = useMemo(() => getPeriodRange(period), [period])
  const prevRange = useMemo(() => getPreviousPeriodRange(period), [period])
  const periodOrders = useMemo(() => filterCompletedOrders(workOrders, range), [workOrders, range])

  // Each tab's data is computed only while that tab is active — Reports used
  // to compute all five tabs' data (customers' O(vehicles×orders) lookups
  // included) on every render regardless of which one was visible.
  const salesData = useMemo(() => {
    if (reportType !== 'sales') return null
    const totalRevenue = periodOrders.reduce((sum, wo) => sum + wo.total, 0)
    const totalServices = periodOrders.length
    return {
      totalRevenue,
      totalServices,
      avgTicket: totalServices > 0 ? totalRevenue / totalServices : 0,
      salesTrend: computeMonthlySalesTrend(completedOrders),
      paymentSplit: computePaymentSplit(periodOrders),
    }
  }, [reportType, periodOrders, completedOrders])

  const getOwnerInfo = (vehicleId: string) => resolveOwnerInfo(vehicleId, vehicles, customers, companies)
  const ownerDisplayName = (name: string) => (name === 'Unknown' ? t('reports.unknown') : name === 'No owner' ? t('reports.noOwner') : name)
  const getOwnerName = (vehicleId: string) => ownerDisplayName(getOwnerInfo(vehicleId).name)

  const customersData = useMemo(() => {
    if (reportType !== 'customers') return null
    const topCustomers = computeTopCustomers(completedOrders, vehicles, customers, companies)
    const customerMix = computeCustomerRevenueMix(completedOrders, vehicles).map(entry => ({
      label: entry.ownerType === 'customer' ? t('reports.individualLabel') : t('reports.companyFleetLabel'),
      value: entry.revenue,
    }))
    const availableYears = [...new Set([currentYear, ...completedOrders.map(wo => orderDate(wo).getFullYear())])]
      .sort((a, b) => b - a)
    const customerActivityGrid = buildHeatmapGrid(computeDailyCustomerCounts(completedOrders, vehicles), heatmapYear)
    return { topCustomers, customerMix, availableYears, customerActivityGrid }
  }, [reportType, completedOrders, vehicles, customers, companies, currentYear, heatmapYear, t])

  const workerStats = useMemo(() => {
    if (reportType !== 'workers') return []
    return computeWorkerPerformance(periodOrders, workers)
  }, [reportType, periodOrders, workers])

  // Inventory metrics — valued from the FIFO lots each product's stock came in
  // on, so mixed-cost stock isn't flattened to one price (lib/inventoryCosting.ts,
  // via src/hooks/useInventoryValuation.ts).
  const inventoryData = useMemo(() => {
    if (reportType !== 'inventory') return null
    const lowStock = products.filter(isLowStock)
    const inventoryValue = products.reduce((sum, p) => sum + productInventoryValue(p, lotValueByProductId), 0)
    const topProductsByValue = computeTopProductsByValue(products, lotValueByProductId)
    const inventoryByCategory = computeInventoryValueByCategory(products, lotValueByProductId).map(entry => ({
      label: productCategoryLabel(entry.category),
      value: entry.amount,
    }))
    return { lowStock, inventoryValue, topProductsByValue, inventoryByCategory }
  }, [reportType, products, lotValueByProductId])

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

      {reportType === 'sales' && salesData && (
        <SalesReportTab data={salesData} periodOrders={periodOrders} periodLabel={periodLabel} getOwnerName={getOwnerName} />
      )}

      {reportType === 'pnl' && <PnlReport period={period} range={range} prevRange={prevRange} />}

      {reportType === 'customers' && customersData && (
        <CustomersReportTab
          data={customersData}
          totalCustomers={customers.length}
          totalCompanies={companies.length}
          totalVehicles={vehicles.length}
          heatmapYear={heatmapYear}
          onHeatmapYearChange={setHeatmapYear}
          ownerDisplayName={ownerDisplayName}
        />
      )}

      {reportType === 'workers' && <WorkersReportTab workerStats={workerStats} periodLabel={periodLabel} />}

      {reportType === 'inventory' && inventoryData && (
        <InventoryReportTab data={inventoryData} products={products} valueByProductId={lotValueByProductId} />
      )}
    </div>
  )
}
