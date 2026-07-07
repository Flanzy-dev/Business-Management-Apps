import { describe, it, expect } from 'vitest'
import type { WorkOrder, WorkOrderItem } from '../../store/workOrderStore'
import type { Expense } from '../../store/expenseStore'
import {
  expenseDate,
  filterCompletedOrders,
  computePnlSummary,
  pctDelta,
  computeMonthlyTrend,
  computeCogs,
  computePaymentSplit,
  PAYMENT_METHODS,
} from '../finance'

let nextId = 1

function item(overrides: Partial<WorkOrderItem> = {}): WorkOrderItem {
  return {
    id: `item-${nextId++}`,
    description: 'Line item',
    quantity: 1,
    unitPrice: 0,
    lineTotal: 0,
    productId: null,
    ...overrides,
  }
}

function order(overrides: Partial<WorkOrder> = {}): WorkOrder {
  return {
    id: `wo-${nextId++}`,
    orderNumber: 1001,
    vehicleId: 'v-1',
    workerId: null,
    driverId: null,
    mileageIn: null,
    date: '2026-06-15',
    items: [],
    subtotal: 0,
    discountPercent: 0,
    discountAmount: 0,
    taxPercent: 0,
    taxAmount: 0,
    total: 0,
    paymentMethod: 'cash',
    status: 'completed',
    notes: '',
    createdAt: new Date(2026, 5, 15, 9, 0).toISOString(),
    completedAt: new Date(2026, 5, 15, 11, 0).toISOString(),
    ...overrides,
  }
}

function expense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: `e-${nextId++}`,
    date: '2026-06-10',
    category: 'Utilities',
    description: 'Expense',
    amount: 0,
    vendor: '',
    notes: '',
    createdAt: new Date(2026, 5, 10).toISOString(),
    ...overrides,
  }
}

describe('expenseDate', () => {
  it('parses YYYY-MM-DD as LOCAL midnight (no UTC day shift)', () => {
    const d = expenseDate(expense({ date: '2026-03-05' }))
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(2)
    expect(d.getDate()).toBe(5)
    expect(d.getHours()).toBe(0)
  })
})

describe('filterCompletedOrders', () => {
  const range = { start: new Date(2026, 5, 1), end: new Date(2026, 5, 15) }

  it('treats the range as half-open [start, end)', () => {
    const atStart = order({ completedAt: new Date(2026, 5, 1, 0, 0).toISOString() })
    const atEnd = order({ completedAt: new Date(2026, 5, 15, 0, 0).toISOString() })
    const result = filterCompletedOrders([atStart, atEnd], range)
    expect(result).toEqual([atStart])
  })

  it('excludes non-completed orders and falls back to createdAt when completedAt is null', () => {
    const open = order({ status: 'open', completedAt: null })
    const legacy = order({ completedAt: null, createdAt: new Date(2026, 5, 5).toISOString() })
    expect(filterCompletedOrders([open, legacy], range)).toEqual([legacy])
  })
})

describe('computePnlSummary', () => {
  it('returns zeros and a null margin for empty inputs', () => {
    expect(computePnlSummary([], [])).toEqual({
      revenue: 0,
      expenses: 0,
      netProfit: 0,
      netMarginPct: null,
    })
  })

  it('keeps margin null when revenue is 0 even with expenses', () => {
    const summary = computePnlSummary([], [expense({ amount: 50_000 })])
    expect(summary.netProfit).toBe(-50_000)
    expect(summary.netMarginPct).toBeNull()
  })

  it('computes revenue, expenses, profit, and margin', () => {
    const summary = computePnlSummary(
      [order({ total: 200_000 })],
      [expense({ amount: 50_000 })]
    )
    expect(summary).toEqual({
      revenue: 200_000,
      expenses: 50_000,
      netProfit: 150_000,
      netMarginPct: 75,
    })
  })
})

describe('pctDelta', () => {
  it('returns null when previous is 0 (no baseline)', () => {
    expect(pctDelta(100, 0)).toBeNull()
  })

  it('computes rounded percent change', () => {
    expect(pctDelta(150, 100)).toBe(50)
  })

  it('uses |previous| so recovering from a loss reads positive', () => {
    expect(pctDelta(50, -100)).toBe(150)
  })
})

describe('computeMonthlyTrend', () => {
  const now = new Date(2026, 5, 15) // June 15, 2026

  it('returns 12 zero-filled buckets oldest to newest ending with the current month', () => {
    const trend = computeMonthlyTrend([], [], 12, now)
    expect(trend).toHaveLength(12)
    expect(trend[0].monthKey).toBe('2025-07')
    expect(trend[11].monthKey).toBe('2026-06')
    expect(trend.every(p => p.revenue === 0 && p.expenses === 0 && p.netProfit === 0)).toBe(true)
  })

  it('buckets orders and expenses into their months and ignores rows outside the window', () => {
    const inWindow = order({ total: 100_000, completedAt: new Date(2026, 4, 20).toISOString() })
    const tooOld = order({ total: 999_999, completedAt: new Date(2025, 4, 20).toISOString() })
    const openOrder = order({ status: 'open', total: 500_000 })
    const mayExpense = expense({ amount: 30_000, date: '2026-05-10' })
    const trend = computeMonthlyTrend([inWindow, tooOld, openOrder], [mayExpense], 12, now)
    const may = trend.find(p => p.monthKey === '2026-05')!
    expect(may.revenue).toBe(100_000)
    expect(may.expenses).toBe(30_000)
    expect(may.netProfit).toBe(70_000)
    const totalRevenue = trend.reduce((sum, p) => sum + p.revenue, 0)
    expect(totalRevenue).toBe(100_000)
  })
})

describe('computeCogs', () => {
  it('splits product/service revenue and segregates deleted-product revenue from COGS', () => {
    const orders = [
      order({
        items: [
          item({ productId: 'p-1', quantity: 2, lineTotal: 100_000 }),
          item({ productId: 'p-deleted', quantity: 1, lineTotal: 40_000 }),
          item({ productId: null, lineTotal: 60_000 }),
        ],
      }),
    ]
    const costMap = new Map([['p-1', 30_000]])
    const cogs = computeCogs(orders, costMap)
    expect(cogs.productRevenue).toBe(140_000)
    expect(cogs.serviceRevenue).toBe(60_000)
    expect(cogs.cogs).toBe(60_000) // 2 × 30,000; deleted product contributes nothing
    expect(cogs.unknownProductRevenue).toBe(40_000)
    expect(cogs.grossProfitOnParts).toBe(80_000)
    expect(cogs.grossMarginPct).toBeCloseTo((80_000 / 140_000) * 100)
  })

  it('returns a null margin when there is no product revenue', () => {
    expect(computeCogs([], new Map()).grossMarginPct).toBeNull()
  })
})

describe('computePaymentSplit', () => {
  it('returns all four methods in fixed order, including pending', () => {
    const split = computePaymentSplit([
      order({ paymentMethod: 'cash', total: 100_000 }),
      order({ paymentMethod: 'pending', total: 50_000 }),
    ])
    expect(split.map(s => s.method)).toEqual([...PAYMENT_METHODS])
    const pending = split.find(s => s.method === 'pending')!
    expect(pending.amount).toBe(50_000)
    expect(pending.count).toBe(1)
    expect(pending.sharePct).toBeCloseTo(100 / 3)
    const shareSum = split.reduce((sum, s) => sum + s.sharePct, 0)
    expect(shareSum).toBeCloseTo(100)
  })

  it('reports zero shares (not NaN) when there are no orders', () => {
    expect(computePaymentSplit([]).every(s => s.sharePct === 0)).toBe(true)
  })
})
