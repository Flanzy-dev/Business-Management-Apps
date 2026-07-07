import { useMemo } from 'react'
import { Banknote, Percent, Receipt, TrendingUp } from 'lucide-react'
import { useWorkOrderStore } from '../../store/workOrderStore'
import { useExpenseStore } from '../../store/expenseStore'
import { useInventoryStore } from '../../store/inventoryStore'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card'
import { StatCard } from '../dashboard/StatCard'
import { RevenueExpenseTrendChart } from './RevenueExpenseTrendChart'
import { ExpenseCategoryBar } from './ExpenseCategoryBar'
import { PaymentMethodBreakdown } from './PaymentMethodBreakdown'
import { formatCurrency } from '../../lib/currency'
import { getPeriodRange, getPreviousPeriodRange, Period } from '../../lib/dates'
import {
  computeCogs,
  computeExpensesByCategory,
  computeMonthlyTrend,
  computePaymentSplit,
  computePnlSummary,
  filterCompletedOrders,
  filterExpensesInRange,
  pctDelta,
} from '../../lib/finance'

const PERIOD_LABEL: Record<Period, string> = {
  day: 'Today',
  week: 'This Week',
  month: 'This Month',
  year: 'This Year',
}

const PREV_LABEL: Record<Period, string> = {
  day: 'vs yesterday',
  week: 'vs last week',
  month: 'vs last month',
  year: 'vs last year',
}

function formatPct(value: number): string {
  return `${value.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`
}

export function PnlReport({ period }: { period: Period }) {
  const workOrders = useWorkOrderStore(s => s.workOrders)
  const expenses = useExpenseStore(s => s.expenses)
  const products = useInventoryStore(s => s.products)

  const costPriceByProductId = useMemo(
    () => new Map(products.map(p => [p.id, p.costPrice])),
    [products]
  )

  const { periodOrders, periodExpenses, summary, prevSummary } = useMemo(() => {
    const range = getPeriodRange(period)
    const prevRange = getPreviousPeriodRange(period)
    const currentOrders = filterCompletedOrders(workOrders, range)
    const currentExpenses = filterExpensesInRange(expenses, range)
    return {
      periodOrders: currentOrders,
      periodExpenses: currentExpenses,
      summary: computePnlSummary(currentOrders, currentExpenses),
      prevSummary: computePnlSummary(
        filterCompletedOrders(workOrders, prevRange),
        filterExpensesInRange(expenses, prevRange)
      ),
    }
  }, [workOrders, expenses, period])

  const trend = useMemo(() => computeMonthlyTrend(workOrders, expenses), [workOrders, expenses])
  const categories = useMemo(() => computeExpensesByCategory(periodExpenses), [periodExpenses])
  const payments = useMemo(() => computePaymentSplit(periodOrders), [periodOrders])
  const cogs = useMemo(
    () => computeCogs(periodOrders, costPriceByProductId),
    [periodOrders, costPriceByProductId]
  )

  const revenueDelta = pctDelta(summary.revenue, prevSummary.revenue)
  const expenseDelta = pctDelta(summary.expenses, prevSummary.expenses)
  const profitDelta = pctDelta(summary.netProfit, prevSummary.netProfit)
  // For expenses, an increase is a bad sign — flip the tone (DESIGN.md §5.1).
  const expenseTone =
    expenseDelta === null ? undefined : expenseDelta > 0 ? 'down' : expenseDelta < 0 ? 'up' : 'neutral'

  const trendHasData = trend.some(p => p.revenue !== 0 || p.expenses !== 0)
  const itemRevenue = cogs.productRevenue + cogs.serviceRevenue
  const periodLabel = PERIOD_LABEL[period]
  const prevLabel = PREV_LABEL[period]

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <Card padding="md">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            title={`Revenue (${periodLabel})`}
            value={formatCurrency(summary.revenue)}
            icon={Banknote}
            delta={revenueDelta ?? undefined}
            deltaLabel={prevLabel}
          />
          <StatCard
            title={`Expenses (${periodLabel})`}
            value={formatCurrency(summary.expenses)}
            icon={Receipt}
            delta={expenseDelta ?? undefined}
            deltaTone={expenseTone}
            deltaLabel={prevLabel}
          />
          <StatCard
            title="Net Profit"
            value={formatCurrency(summary.netProfit)}
            icon={TrendingUp}
            delta={profitDelta ?? undefined}
            deltaLabel={prevLabel}
          />
          <StatCard
            title="Net Margin"
            value={summary.netMarginPct === null ? '—' : formatPct(summary.netMarginPct)}
            icon={Percent}
            hint="net profit / revenue"
          />
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue vs Expenses trend */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Revenue vs Expenses</CardTitle>
            <p className="text-caption">Last 12 months · monthly</p>
          </CardHeader>
          <CardContent>
            {trendHasData ? (
              <RevenueExpenseTrendChart data={trend} />
            ) : (
              <p className="text-text-secondary text-center py-12">
                No financial activity in the last 12 months.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Margin & COGS */}
        <Card>
          <CardHeader>
            <CardTitle>Margin &amp; COGS (estimate)</CardTitle>
            <p className="text-caption">Current cost prices · line items, pre-discount/tax</p>
          </CardHeader>
          <CardContent>
            {periodOrders.length === 0 ? (
              <p className="text-text-secondary text-center py-12">
                No completed orders in this period.
              </p>
            ) : (
              <div className="space-y-4">
                {itemRevenue > 0 && (
                  <div className="flex h-2 rounded-radius-full overflow-hidden gap-0.5">
                    <div
                      className="bg-info"
                      style={{ width: `${(cogs.productRevenue / itemRevenue) * 100}%` }}
                    />
                    <div
                      className="bg-accent"
                      style={{ width: `${(cogs.serviceRevenue / itemRevenue) * 100}%` }}
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-radius-full bg-info shrink-0" />
                    <span className="text-text-primary flex-1">Parts revenue</span>
                    <span className="font-mono text-text-primary tabular-nums">
                      {formatCurrency(cogs.productRevenue)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-radius-full bg-accent shrink-0" />
                    <span className="text-text-primary flex-1">Service revenue</span>
                    <span className="font-mono text-text-primary tabular-nums">
                      {formatCurrency(cogs.serviceRevenue)}
                    </span>
                  </div>
                </div>
                <div className="border-t border-border-subtle pt-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-text-secondary">COGS (est.)</span>
                    <span className="font-mono text-danger tabular-nums">
                      −{formatCurrency(cogs.cogs)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-secondary">Gross profit on parts</span>
                    <span className="font-mono text-text-primary tabular-nums">
                      {formatCurrency(cogs.grossProfitOnParts)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-secondary">Gross margin (parts)</span>
                    <span className="font-mono text-text-primary tabular-nums">
                      {cogs.grossMarginPct === null ? '—' : formatPct(cogs.grossMarginPct)}
                    </span>
                  </div>
                </div>
                {cogs.unknownProductRevenue > 0 && (
                  <p className="text-xs text-text-secondary">
                    {formatCurrency(cogs.unknownProductRevenue)} of parts revenue is from deleted
                    products — no cost data, excluded from COGS.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expenses by category */}
        <Card>
          <CardHeader>
            <CardTitle>Expenses by Category ({periodLabel})</CardTitle>
          </CardHeader>
          <CardContent>
            {categories.length === 0 ? (
              <p className="text-text-secondary text-center py-12">No expenses in this period.</p>
            ) : (
              <ExpenseCategoryBar data={categories} />
            )}
          </CardContent>
        </Card>

        {/* Revenue by payment method */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue by Payment Method ({periodLabel})</CardTitle>
          </CardHeader>
          <CardContent>
            {summary.revenue === 0 ? (
              <p className="text-text-secondary text-center py-12">
                No completed orders in this period.
              </p>
            ) : (
              <PaymentMethodBreakdown data={payments} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
