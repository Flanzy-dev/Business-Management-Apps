// Pure financial derivations for the P&L report. No store subscriptions here —
// callers pass raw arrays so everything stays memoizable and unit-testable.
import type { WorkOrder } from '../store/workOrderStore'
import type { Expense } from '../store/expenseStore'
import type { Vehicle } from '../store/vehicleStore'
import type { Customer } from '../store/customerStore'
import type { Company } from '../store/companyStore'
import type { Worker } from '../store/workerStore'
import type { ProductWithStock } from './stockLedger'
import type { DateRange } from './dates'
import { lastNMonthKeys, monthKeyLocal, monthLabel, dayKeyLocal } from './dateKeys'
import { ownerName } from './entities'

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
  /** Cost of goods sold: each line's frozen FIFO cost where it has one. */
  cogs: number
  /** Product-linked revenue with neither a stored cost nor a surviving product. */
  unknownProductRevenue: number
  grossProfitOnParts: number
  /** null when there is no product revenue. */
  grossMarginPct: number | null
}

/**
 * Cost of goods sold. A line completed under FIFO costing carries its own
 * `costOfGoods` — what the specific stock it consumed actually cost — so this
 * figure never moves when a product's cost price is edited later. Lines sold
 * before that (or backfilled ones) fall back to the product's current cost.
 */
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
        if (item.costOfGoods != null) {
          cogs += item.costOfGoods
        } else {
          const cost = costPriceByProductId.get(item.productId)
          if (cost === undefined) {
            unknownProductRevenue += item.lineTotal
          } else {
            cogs += Math.round(item.quantity * cost)
          }
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
  'qris',
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

export interface MonthlySalesPoint {
  monthKey: string
  month: string
  revenue: number
  orderCount: number
}

/** Monthly revenue/order-count series for the Sales report trend chart. */
export function computeMonthlySalesTrend(
  orders: WorkOrder[],
  months = 12,
  now: Date = new Date()
): MonthlySalesPoint[] {
  const byKey = new Map<string, MonthlySalesPoint>(
    lastNMonthKeys(months, now).map(key => [
      key,
      { monthKey: key, month: monthLabel(key), revenue: 0, orderCount: 0 },
    ])
  )
  for (const wo of orders) {
    if (wo.status !== 'completed') continue
    const point = byKey.get(monthKeyLocal(orderDate(wo)))
    if (point) {
      point.revenue += wo.total
      point.orderCount += 1
    }
  }
  return [...byKey.values()]
}

export interface OwnerInfo {
  type: 'customer' | 'company' | 'unknown'
  id: string
  name: string
}

/** Owning customer/company info for a vehicle — name/fallback text delegates to `ownerName` in entities.ts. */
export function resolveOwnerInfo(
  vehicleId: string,
  vehicles: Vehicle[],
  customers: Customer[],
  companies: Company[]
): OwnerInfo {
  const v = vehicles.find(x => x.id === vehicleId)
  const name = ownerName(v, customers, companies)
  if (v?.customerId) return { type: 'customer', id: v.customerId, name }
  if (v?.companyId) return { type: 'company', id: v.companyId, name }
  return { type: 'unknown', id: '', name }
}

export interface CustomerRevenueEntry {
  type: OwnerInfo['type']
  id: string
  name: string
  revenue: number
  visits: number
}

/** Top customers/companies by revenue across all completed orders. */
export function computeTopCustomers(
  orders: WorkOrder[],
  vehicles: Vehicle[],
  customers: Customer[],
  companies: Company[],
  limit = 10
): CustomerRevenueEntry[] {
  const byKey = new Map<string, CustomerRevenueEntry>()
  for (const wo of orders) {
    const owner = resolveOwnerInfo(wo.vehicleId, vehicles, customers, companies)
    const key = `${owner.type}:${owner.id}`
    const entry = byKey.get(key) ?? { ...owner, revenue: 0, visits: 0 }
    entry.revenue += wo.total
    entry.visits += 1
    byKey.set(key, entry)
  }
  return [...byKey.values()].sort((a, b) => b.revenue - a.revenue).slice(0, limit)
}

export interface CustomerRevenueMixEntry {
  ownerType: 'customer' | 'company'
  revenue: number
}

/** Revenue split between individual customers and company/fleet accounts. */
export function computeCustomerRevenueMix(orders: WorkOrder[], vehicles: Vehicle[]): CustomerRevenueMixEntry[] {
  let customerRevenue = 0
  let companyRevenue = 0
  for (const wo of orders) {
    const v = vehicles.find(x => x.id === wo.vehicleId)
    if (v?.customerId) customerRevenue += wo.total
    else if (v?.companyId) companyRevenue += wo.total
  }
  return [
    { ownerType: 'customer', revenue: customerRevenue },
    { ownerType: 'company', revenue: companyRevenue },
  ]
}

export interface WorkerPerformanceEntry {
  id: string
  name: string
  isActive: boolean
  revenue: number
  jobCount: number
  avgJobValue: number
}

/** Per-worker revenue/job-count/average-ticket for the given (already period-filtered) orders. */
export function computeWorkerPerformance(orders: WorkOrder[], workers: Worker[]): WorkerPerformanceEntry[] {
  return workers
    .map(w => {
      const workerOrders = orders.filter(wo => wo.workerId === w.id)
      const revenue = workerOrders.reduce((sum, wo) => sum + wo.total, 0)
      const jobCount = workerOrders.length
      return {
        id: w.id,
        name: w.name,
        isActive: w.isActive,
        revenue,
        jobCount,
        avgJobValue: jobCount > 0 ? revenue / jobCount : 0,
      }
    })
    .sort((a, b) => b.revenue - a.revenue)
}

export interface ProductValueEntry {
  id: string
  name: string
  value: number
}

/**
 * What a product's stock on hand is worth: the sum of its remaining FIFO lots
 * (see lib/inventoryCosting.ts), falling back to cost price × quantity for a
 * product with no lots — stock that predates lot costing, or was added without
 * a purchase being recorded.
 */
export function productInventoryValue(product: ProductWithStock, valueByProductId: Map<string, number>): number {
  return valueByProductId.get(product.id) ?? product.costPrice * product.qtyOnHand
}

/** Top products by current inventory value. */
export function computeTopProductsByValue(
  products: ProductWithStock[],
  valueByProductId: Map<string, number>,
  limit = 10
): ProductValueEntry[] {
  return [...products]
    .map(p => ({ id: p.id, name: p.name, value: productInventoryValue(p, valueByProductId) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)
}

/** Inventory value grouped by product category. */
export function computeInventoryValueByCategory(
  products: ProductWithStock[],
  valueByProductId: Map<string, number>
): CategoryTotal[] {
  const totals = new Map<string, number>()
  for (const p of products) {
    totals.set(p.category, (totals.get(p.category) ?? 0) + productInventoryValue(p, valueByProductId))
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

export interface DailyCustomerCount {
  date: string
  count: number
}

/**
 * Distinct customers/companies with a completed visit on each day (sparse —
 * only days with ≥1 visit). A customer with two same-day orders counts once;
 * a customer and a company visiting the same day count as two.
 */
export function computeDailyCustomerCounts(orders: WorkOrder[], vehicles: Vehicle[]): DailyCustomerCount[] {
  const ownersByDay = new Map<string, Set<string>>()
  for (const wo of orders) {
    if (wo.status !== 'completed') continue
    const v = vehicles.find(x => x.id === wo.vehicleId)
    if (!v || (!v.customerId && !v.companyId)) continue
    const ownerKey = v.customerId ? `customer:${v.customerId}` : `company:${v.companyId}`
    const day = dayKeyLocal(orderDate(wo))
    const owners = ownersByDay.get(day) ?? new Set<string>()
    owners.add(ownerKey)
    ownersByDay.set(day, owners)
  }
  return [...ownersByDay.entries()]
    .map(([date, owners]) => ({ date, count: owners.size }))
    .sort((a, b) => a.date.localeCompare(b.date))
}
