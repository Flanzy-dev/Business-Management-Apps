import { useMemo } from 'react'
import { useWorkOrderStore } from '../../store/workOrderStore'
import { useExpenseStore } from '../../store/expenseStore'
import { useInventoryStore } from '../../store/inventoryStore'
import { PnlKpiRow } from './PnlKpiRow'
import { PnlTrendCard } from './PnlTrendCard'
import { PnlMarginCogsCard } from './PnlMarginCogsCard'
import { PnlExpenseCategoryCard } from './PnlExpenseCategoryCard'
import { PnlPaymentMethodCard } from './PnlPaymentMethodCard'
import { DateRange, Period } from '../../lib/dates'
import {
  computeCogs,
  computeExpensesByCategory,
  computeMonthlyTrend,
  computePaymentSplit,
  computePnlSummary,
  filterCompletedOrders,
  filterExpensesInRange,
  inverseTone,
  pctDelta,
} from '../../lib/finance'
import { useTranslation } from '../../lib/i18n'

// `range`/`prevRange` are computed once by Reports.tsx (the parent, which
// already needs its own period range for the other tabs) and passed down —
// see that file's comment. This component used to call getPeriodRange(period)
// itself, independently of the parent's own call, one render apart.
export function PnlReport({ period, range, prevRange }: { period: Period; range: DateRange; prevRange: DateRange }) {
  const { t } = useTranslation()
  const PERIOD_LABEL: Record<Period, string> = {
    day: t('reports.periodLabelDay'),
    week: t('reports.periodLabelWeek'),
    month: t('reports.periodLabelMonth'),
    year: t('reports.periodLabelYear'),
  }
  const PREV_LABEL: Record<Period, string> = {
    day: t('pnlReport.prevLabelDay'),
    week: t('pnlReport.prevLabelWeek'),
    month: t('pnlReport.prevLabelMonth'),
    year: t('pnlReport.prevLabelYear'),
  }
  const workOrders = useWorkOrderStore(s => s.workOrders)
  const expenses = useExpenseStore(s => s.expenses)
  const products = useInventoryStore(s => s.products)

  const costPriceByProductId = useMemo(
    () => new Map(products.map(p => [p.id, p.costPrice])),
    [products]
  )

  const { periodOrders, periodExpenses, summary, prevSummary } = useMemo(() => {
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
  }, [workOrders, expenses, range, prevRange])

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
  const expenseTone = inverseTone(expenseDelta)

  const periodLabel = PERIOD_LABEL[period]
  const prevLabel = PREV_LABEL[period]

  return (
    <div className="space-y-6">
      <PnlKpiRow
        summary={summary}
        revenueDelta={revenueDelta}
        expenseDelta={expenseDelta}
        expenseTone={expenseTone}
        profitDelta={profitDelta}
        periodLabel={periodLabel}
        prevLabel={prevLabel}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <PnlTrendCard trend={trend} />
        <PnlMarginCogsCard hasCompletedOrders={periodOrders.length > 0} cogs={cogs} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PnlExpenseCategoryCard periodLabel={periodLabel} categories={categories} />
        <PnlPaymentMethodCard periodLabel={periodLabel} hasRevenue={summary.revenue !== 0} payments={payments} />
      </div>
    </div>
  )
}
