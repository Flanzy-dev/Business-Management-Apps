import { describe, it, expect } from 'vitest'
import type { WorkOrder, WorkOrderItem } from '../../store/workOrderStore'
import type { Expense } from '../../store/expenseStore'
import type { Vehicle } from '../../store/vehicleStore'
import type { Customer } from '../../store/customerStore'
import type { Company } from '../../store/companyStore'
import type { Worker } from '../../store/workerStore'
import type { ProductWithStock } from '../stockLedger'
import {
  expenseDate,
  filterCompletedOrders,
  computePnlSummary,
  pctDelta,
  computeMonthlyTrend,
  computeCogs,
  computePaymentSplit,
  PAYMENT_METHODS,
  computeMonthlySalesTrend,
  resolveOwnerInfo,
  computeTopCustomers,
  inverseTone,
  computeCustomerRevenueMix,
  computeWorkerPerformance,
  computeTopProductsByValue,
  computeInventoryValueByCategory,
  computeDailyCustomerCounts,
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
    odometerAtArrival: null,
    odometerAtService: null,
    date: '2026-06-15',
    items: [],
    subtotal: 0,
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
    productId: null,
    quantityAffected: null,
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

describe('inverseTone', () => {
  it('is undefined with no baseline', () => {
    expect(inverseTone(null)).toBeUndefined()
  })

  it('flips an increase to the bad-news tone', () => {
    expect(inverseTone(20)).toBe('down')
  })

  it('flips a decrease to the good-news tone', () => {
    expect(inverseTone(-20)).toBe('up')
  })

  it('is neutral at exactly no change', () => {
    expect(inverseTone(0)).toBe('neutral')
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

  it("uses the line's frozen FIFO cost instead of today's cost price", () => {
    // 6 @ 40.000 + 2 @ 55.000 was stamped at completion; the product's cost
    // price has since been edited to 55.000. The old sale must not move.
    const orders = [
      order({ items: [item({ productId: 'p-1', quantity: 8, lineTotal: 800_000, costOfGoods: 350_000 })] }),
    ]
    expect(computeCogs(orders, new Map([['p-1', 55_000]])).cogs).toBe(350_000)
  })

  it('still counts a frozen cost when the product has since been deleted', () => {
    const orders = [
      order({ items: [item({ productId: 'gone', quantity: 2, lineTotal: 90_000, costOfGoods: 50_000 })] }),
    ]
    const cogs = computeCogs(orders, new Map())
    expect(cogs.cogs).toBe(50_000)
    expect(cogs.unknownProductRevenue).toBe(0)
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

function vehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: `v-${nextId++}`,
    customerId: null,
    companyId: null,
    make: 'Toyota',
    model: 'Avanza',
    year: 2020,
    vin: '',
    licensePlate: '',
    color: '',
    currentMileage: null,
    engineType: '',
    engineSize: '',
    oilTypeRequired: '',
    oilCapacity: '',
    transmissionType: '',
    transmissionFluidType: '',
    driveType: '',
    differentialFluidType: '',
    notes: '',
    createdAt: new Date(2026, 0, 1).toISOString(),
    ...overrides,
  }
}

function customer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: `c-${nextId++}`,
    name: 'Customer',
    phone: '',
    email: '',
    address: '',
    notes: '',
    createdAt: new Date(2026, 0, 1).toISOString(),
    ...overrides,
  }
}

function company(overrides: Partial<Company> = {}): Company {
  return {
    id: `co-${nextId++}`,
    companyName: 'Company',
    contactPerson: '',
    phone: '',
    email: '',
    billingAddress: '',
    notes: '',
    createdAt: new Date(2026, 0, 1).toISOString(),
    drivers: [],
    ...overrides,
  }
}

function worker(overrides: Partial<Worker> = {}): Worker {
  return {
    id: `w-${nextId++}`,
    name: 'Worker',
    phone: '',
    employeeId: '',
    hireDate: '',
    isActive: true,
    notes: '',
    createdAt: new Date(2026, 0, 1).toISOString(),
    ...overrides,
  }
}

function product(overrides: Partial<ProductWithStock> = {}): ProductWithStock {
  return {
    id: `p-${nextId++}`,
    name: 'Product',
    sku: '',
    supplierCode: '',
    category: 'Oil',
    unit: 'each',
    costPrice: 0,
    sellPrice: 0,
    qtyOnHand: 0,
    reorderPoint: 0,
    supplierId: null,
    notes: '',
    createdAt: new Date(2026, 0, 1).toISOString(),
    ...overrides,
  }
}

describe('computeMonthlySalesTrend', () => {
  const now = new Date(2026, 5, 15)

  it('returns 12 zero-filled buckets and ignores non-completed orders', () => {
    const trend = computeMonthlySalesTrend([order({ status: 'open' })], 12, now)
    expect(trend).toHaveLength(12)
    expect(trend.every(p => p.revenue === 0 && p.orderCount === 0)).toBe(true)
  })

  it('buckets revenue and order count into the completion month', () => {
    const a = order({ total: 100_000, completedAt: new Date(2026, 4, 20).toISOString() })
    const b = order({ total: 50_000, completedAt: new Date(2026, 4, 22).toISOString() })
    const trend = computeMonthlySalesTrend([a, b], 12, now)
    const may = trend.find(p => p.monthKey === '2026-05')!
    expect(may.revenue).toBe(150_000)
    expect(may.orderCount).toBe(2)
  })
})

describe('resolveOwnerInfo', () => {
  const cust = customer({ name: 'Budi' })
  const comp = company({ companyName: 'PT Maju' })
  const vCustomer = vehicle({ customerId: cust.id })
  const vCompany = vehicle({ companyId: comp.id })
  const vOrphan = vehicle()

  it('resolves a customer-owned vehicle', () => {
    expect(resolveOwnerInfo(vCustomer.id, [vCustomer], [cust], [])).toEqual({
      type: 'customer', id: cust.id, name: 'Budi',
    })
  })

  it('resolves a company-owned vehicle', () => {
    expect(resolveOwnerInfo(vCompany.id, [vCompany], [], [comp])).toEqual({
      type: 'company', id: comp.id, name: 'PT Maju',
    })
  })

  it('falls back to "No owner" when the vehicle has neither link, and "Unknown" when the vehicle id does not resolve', () => {
    expect(resolveOwnerInfo(vOrphan.id, [vOrphan], [], [])).toEqual({ type: 'unknown', id: '', name: 'No owner' })
    expect(resolveOwnerInfo('missing', [], [], [])).toEqual({ type: 'unknown', id: '', name: 'Unknown' })
  })
})

describe('computeTopCustomers', () => {
  it('groups revenue/visits by owner and sorts descending', () => {
    const cust = customer({ name: 'Budi' })
    const v = vehicle({ customerId: cust.id })
    const orders = [
      order({ vehicleId: v.id, total: 100_000 }),
      order({ vehicleId: v.id, total: 50_000 }),
    ]
    const result = computeTopCustomers(orders, [v], [cust], [])
    expect(result).toEqual([{ type: 'customer', id: cust.id, name: 'Budi', revenue: 150_000, visits: 2 }])
  })

  it('respects the limit', () => {
    const customers = [customer(), customer(), customer()]
    const vehicles = customers.map(c => vehicle({ customerId: c.id }))
    const orders = vehicles.map((v, i) => order({ vehicleId: v.id, total: (i + 1) * 10_000 }))
    expect(computeTopCustomers(orders, vehicles, customers, [], 2)).toHaveLength(2)
  })
})

describe('computeCustomerRevenueMix', () => {
  it('splits revenue between individual and company-owned vehicles', () => {
    const vCust = vehicle({ customerId: 'c-1' })
    const vComp = vehicle({ companyId: 'co-1' })
    const orders = [
      order({ vehicleId: vCust.id, total: 100_000 }),
      order({ vehicleId: vComp.id, total: 40_000 }),
    ]
    const mix = computeCustomerRevenueMix(orders, [vCust, vComp])
    expect(mix).toEqual([
      { ownerType: 'customer', revenue: 100_000 },
      { ownerType: 'company', revenue: 40_000 },
    ])
  })
})

describe('computeWorkerPerformance', () => {
  it('computes revenue, job count, and average job value per worker, sorted by revenue', () => {
    const w1 = worker({ name: 'Andi' })
    const w2 = worker({ name: 'Budi' })
    const orders = [
      order({ workerId: w1.id, total: 100_000 }),
      order({ workerId: w1.id, total: 50_000 }),
      order({ workerId: w2.id, total: 200_000 }),
    ]
    const result = computeWorkerPerformance(orders, [w1, w2])
    expect(result[0]).toMatchObject({ name: 'Budi', revenue: 200_000, jobCount: 1, avgJobValue: 200_000 })
    expect(result[1]).toMatchObject({ name: 'Andi', revenue: 150_000, jobCount: 2, avgJobValue: 75_000 })
  })

  it('reports zero avgJobValue for a worker with no jobs', () => {
    const w = worker()
    expect(computeWorkerPerformance([], [w])[0].avgJobValue).toBe(0)
  })
})

describe('computeTopProductsByValue', () => {
  it('sorts by inventory value, descending, and respects the limit', () => {
    const cheap = product({ name: 'Cheap', costPrice: 1_000, qtyOnHand: 5 })
    const pricey = product({ name: 'Pricey', costPrice: 100_000, qtyOnHand: 2 })
    const result = computeTopProductsByValue([cheap, pricey], new Map(), 1)
    expect(result).toEqual([{ id: pricey.id, name: 'Pricey', value: 200_000 }])
  })

  it('prefers the lot value over cost price × quantity when lots exist', () => {
    // Mixed-cost stock: 6 @ 40.000 + 10 @ 55.000 is worth 790.000, not
    // 16 × whatever costPrice happens to say today.
    const p = product({ name: 'Oil', costPrice: 40_000, qtyOnHand: 16 })
    const result = computeTopProductsByValue([p], new Map([[p.id, 790_000]]))
    expect(result[0].value).toBe(790_000)
  })
})

describe('computeInventoryValueByCategory', () => {
  it('groups value by category and computes shares summing to 100', () => {
    const oil = product({ category: 'Oil', costPrice: 10_000, qtyOnHand: 3 })
    const filter = product({ category: 'Filter', costPrice: 5_000, qtyOnHand: 2 })
    const result = computeInventoryValueByCategory([oil, filter], new Map())
    expect(result.find(c => c.category === 'Oil')!.amount).toBe(30_000)
    expect(result.reduce((sum, c) => sum + c.sharePct, 0)).toBeCloseTo(100)
  })

  it('uses lot value where a product has lots and falls back where it does not', () => {
    const oil = product({ category: 'Oil', costPrice: 10_000, qtyOnHand: 3 })
    const filter = product({ category: 'Filter', costPrice: 5_000, qtyOnHand: 2 })
    const result = computeInventoryValueByCategory([oil, filter], new Map([[oil.id, 45_000]]))
    expect(result.find(c => c.category === 'Oil')!.amount).toBe(45_000)
    expect(result.find(c => c.category === 'Filter')!.amount).toBe(10_000)
  })

  it('returns zero shares (not NaN) for empty input', () => {
    expect(computeInventoryValueByCategory([], new Map())).toEqual([])
  })
})

describe('computeDailyCustomerCounts', () => {
  it('counts a customer with two same-day orders once', () => {
    const cust = customer()
    const v = vehicle({ customerId: cust.id })
    const orders = [
      order({ vehicleId: v.id, completedAt: new Date(2026, 5, 10, 9).toISOString() }),
      order({ vehicleId: v.id, completedAt: new Date(2026, 5, 10, 15).toISOString() }),
    ]
    expect(computeDailyCustomerCounts(orders, [v])).toEqual([{ date: '2026-06-10', count: 1 }])
  })

  it('counts a customer and a company on the same day as two', () => {
    const vCust = vehicle({ customerId: 'c-1' })
    const vComp = vehicle({ companyId: 'co-1' })
    const orders = [
      order({ vehicleId: vCust.id, completedAt: new Date(2026, 5, 10).toISOString() }),
      order({ vehicleId: vComp.id, completedAt: new Date(2026, 5, 10).toISOString() }),
    ]
    expect(computeDailyCustomerCounts(orders, [vCust, vComp])).toEqual([{ date: '2026-06-10', count: 2 }])
  })

  it('ignores non-completed orders and vehicles with no owner', () => {
    const vOrphan = vehicle()
    const vOpen = vehicle({ customerId: 'c-2' })
    const orders = [
      order({ vehicleId: vOrphan.id, completedAt: new Date(2026, 5, 10).toISOString() }),
      order({ vehicleId: vOpen.id, status: 'open', completedAt: null }),
    ]
    expect(computeDailyCustomerCounts(orders, [vOrphan, vOpen])).toEqual([])
  })

  it('returns days sorted ascending, sparse (only days with visits)', () => {
    const v = vehicle({ customerId: 'c-1' })
    const orders = [
      order({ vehicleId: v.id, completedAt: new Date(2026, 5, 15).toISOString() }),
      order({ vehicleId: v.id, completedAt: new Date(2026, 5, 10).toISOString() }),
    ]
    expect(computeDailyCustomerCounts(orders, [v]).map(d => d.date)).toEqual(['2026-06-10', '2026-06-15'])
  })
})
