// Pure financial derivations for the P&L report. No store subscriptions here —
// callers pass raw arrays so everything stays memoizable and unit-testable.
import type { WorkOrder } from '../store/workOrderStore'
import type { Expense } from '../store/expenseStore'
import type { DateRange } from './dates'
import { lastNMonthKeys, monthKeyLocal, monthLabel } from './dates'

/** Revenue is recognized on completion; fall back to createdAt for legacy rows. */
export function orderDate(wo: WorkOrder): Date {
  return new Date(wo.completedAt ?? wo.createdAt)
}

/**
 * Expense dates are 'YYYY-MM-DD' from the date input; parse as LOCAL midnight
 * (new Date('YYYY-MM-DD') would parse as UTC and shift the day in WIB/WITA/WIT).
 */
export function expenseDate(e: Expense): Date {
  const [year, month, day] = e.date.slice(0, 10).split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function filterCompletedOrders(orders: WorkOrder[], range: DateRange): WorkOrder[] {
  return orders.filter(wo => {
    if (wo.status !== 'completed') return false
    const d = orderDate(wo)
    return d >= range.start && d < range.end
  })
}

export function filterExpensesInRange(expenses: Expense[], range: DateRange): Expense[] {
  return expenses.filter(e => {
    const d = expenseDate(e)
    return d >= range.start && d < range.end
  })
}

export interface PnlSummary {
  revenue: number
  expenses: number
  netProfit: number
  /** null when revenue is 0 (margin undefined). */
  netMarginPct: number | null
}

export function computePnlSummary(orders: WorkOrder[], expenses: Expense[]): PnlSummary {
  const revenue = orders.reduce((sum, wo) => sum + wo.total, 0)
  const expenseTotal = expenses.reduce((sum, e) => sum + e.amount, 0)
  const netProfit = revenue - expenseTotal
  return {
    revenue,
    expenses: expenseTotal,
    netProfit,
    netMarginPct: revenue > 0 ? (netProfit / revenue) * 100 : null,
  }
}

/**
 * Rounded percent change vs previous. null when previous is 0 (no baseline).
 * Denominator uses |previous| so "improved from a loss" still reads positive.
 */
export function pctDelta(current: number, previous: number): number | null {
  if (previous === 0) return null
  return Math.round(((current - previous) / Math.abs(previous)) * 100)
}

export interface MonthlyPnlPoint {
  monthKey: string
  month: string
  revenue: number
  expenses: number
  netProfit: number
}

/** Monthly revenue/expense/profit series; months without activity stay at 0. */
export function computeMonthlyTrend(
  orders: WorkOrder[],
  expenses: Expense[],
  months = 12,
  now: Date = new Date()
): MonthlyPnlPoint[] {
  const byKey = new Map<string, MonthlyPnlPoint>(
    lastNMonthKeys(months, now).map(key => [
      key,
      { monthKey: key, month: monthLabel(key), revenue: 0, expenses: 0, netProfit: 0 },
    ])
  )
  for (const wo of orders) {
    if (wo.status !== 'completed') continue
    const point = byKey.get(monthKeyLocal(orderDate(wo)))
    if (point) point.revenue += wo.total
  }
  for (const e of expenses) {
    // 'YYYY-MM-DD' string slice — timezone-proof month bucket.
    const point = byKey.get(e.date.slice(0, 7))
    if (point) point.expenses += e.amount
  }
  for (const point of byKey.values()) point.netProfit = point.revenue - point.expenses
  return [...byKey.values()]
}

export interface CategoryTotal {
  category: string
  amount: number
  sharePct: number
}

export function computeExpensesByCategory(expenses: Expense[]): CategoryTotal[] {
  const totals = new Map<string, number>()
  for (const e of expenses) {
    totals.set(e.category, (totals.get(e.category) ?? 0) + e.amount)
  }
  const grand = [...totals.values()].reduce((sum, v) => sum + v, 0)
  return [...totals.entries()]
    .map(([category, amount]) => ({
      category,
      amount,
      sharePct: grand > 0 ? (amount / grand) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount)
}

export interface CogsBreakdown {
  /** Line totals of items linked to an inventory product (pre-discount/tax). */
  productRevenue: number
  /** Line totals of free-form items with no productId (labor/services). */
  serviceRevenue: number
  /** Estimated cost of goods sold at CURRENT product cost prices. */
  cogs: number
  /** Product-linked revenue whose product no longer exists — no cost data. */
  unknownProductRevenue: number
  grossProfitOnParts: number
  /** null when there is no product revenue. */
  grossMarginPct: number | null
}

export function computeCogs(
  orders: WorkOrder[],
  costPriceByProductId: Map<string, number>
): CogsBreakdown {
  let productRevenue = 0
  let serviceRevenue = 0
  let cogs = 0
  let unknownProductRevenue = 0
  for (const wo of orders) {
    for (const item of wo.items) {
      if (item.productId) {
        productRevenue += item.lineTotal
        const cost = costPriceByProductId.get(item.productId)
        if (cost === undefined) {
          unknownProductRevenue += item.lineTotal
        } else {
          cogs += Math.round(item.quantity * cost)
        }
      } else {
        serviceRevenue += item.lineTotal
      }
    }
  }
  const grossProfitOnParts = productRevenue - cogs
  return {
    productRevenue,
    serviceRevenue,
    cogs,
    unknownProductRevenue,
    grossProfitOnParts,
    grossMarginPct: productRevenue > 0 ? (grossProfitOnParts / productRevenue) * 100 : null,
  }
}

export const PAYMENT_METHODS: readonly WorkOrder['paymentMethod'][] = [
  'cash',
  'card',
  'check',
  'pending',
]

export interface PaymentSplit {
  method: WorkOrder['paymentMethod']
  amount: number
  count: number
  sharePct: number
}

/** Revenue split by payment method, in fixed display order. */
export function computePaymentSplit(orders: WorkOrder[]): PaymentSplit[] {
  const total = orders.reduce((sum, wo) => sum + wo.total, 0)
  return PAYMENT_METHODS.map(method => {
    const methodOrders = orders.filter(wo => wo.paymentMethod === method)
    const amount = methodOrders.reduce((sum, wo) => sum + wo.total, 0)
    return {
      method,
      amount,
      count: methodOrders.length,
      sharePct: total > 0 ? (amount / total) * 100 : 0,
    }
  })
}
