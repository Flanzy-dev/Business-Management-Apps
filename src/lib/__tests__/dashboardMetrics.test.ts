import { describe, it, expect } from 'vitest'
import type { WorkOrder, WorkOrderItem } from '../../store/workOrderStore'
import type { Customer } from '../../store/customerStore'
import type { Bay } from '../../store/bayStore'
import type { Worker } from '../../store/workerStore'
import type { Appointment } from '../../store/appointmentStore'
import {
  computePeriodKpis,
  computeBayCapacity,
  buildBayStatusBoard,
  buildTechnicianQueue,
  computeServiceMix,
  computeThroughput,
  computeRepeatCustomerBuckets,
  computeAppointmentTrend,
  computeTodaysAppointments,
} from '../dashboardMetrics'

let nextId = 1
const TODAY = new Date(2026, 5, 15, 12, 0, 0) // Mon Jun 15 2026, noon

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
    createdAt: TODAY.toISOString(),
    completedAt: TODAY.toISOString(),
    ...overrides,
  }
}

function customer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: `cust-${nextId++}`,
    name: 'Budi',
    phone: '',
    email: '',
    address: '',
    notes: '',
    createdAt: TODAY.toISOString(),
    ...overrides,
  }
}

function bay(overrides: Partial<Bay> = {}): Bay {
  return {
    id: `bay-${nextId++}`,
    name: 'Bay 1',
    status: 'available',
    currentWorkOrderId: null,
    assignedWorkerId: null,
    estimatedEndTime: null,
    createdAt: TODAY.toISOString(),
    updatedAt: TODAY.toISOString(),
    ...overrides,
  }
}

function worker(overrides: Partial<Worker> = {}): Worker {
  return {
    id: `worker-${nextId++}`,
    name: 'Tech',
    phone: '',
    employeeId: '',
    hireDate: TODAY.toISOString(),
    isActive: true,
    notes: '',
    createdAt: TODAY.toISOString(),
    ...overrides,
  }
}

function appointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: `appt-${nextId++}`,
    vehicleId: null,
    customerId: null,
    companyId: null,
    scheduledAt: TODAY.toISOString(),
    duration: 60,
    serviceType: null,
    isWalkIn: false,
    status: 'scheduled',
    notes: null,
    createdAt: TODAY.toISOString(),
    updatedAt: TODAY.toISOString(),
    ...overrides,
  }
}

describe('computePeriodKpis', () => {
  const dayRange = { start: new Date(2026, 5, 15), end: new Date(2026, 5, 16) }
  const prevDayRange = { start: new Date(2026, 5, 14), end: new Date(2026, 5, 15) }
  const yesterdayNoon = new Date(2026, 5, 14, 12).toISOString()

  it('sums revenue/vehicles/parts for completed orders in range, excluding the prior period', () => {
    const orders = [
      order({ total: 100000, items: [item({ quantity: 2 })], completedAt: TODAY.toISOString() }),
      order({ total: 999999, completedAt: yesterdayNoon }),
      order({ total: 50000, status: 'open', completedAt: null, createdAt: TODAY.toISOString() }),
    ]
    const result = computePeriodKpis(orders, [], dayRange, prevDayRange)
    expect(result.revenue).toBe(100000)
    expect(result.vehiclesServiced).toBe(1)
    expect(result.partsUsed).toBe(2)
  })

  it('reports delta as null (not 0) when the prior period had no activity — matches finance.ts pctDelta', () => {
    const orders = [order({ total: 100000, completedAt: TODAY.toISOString() })]
    const result = computePeriodKpis(orders, [], dayRange, prevDayRange)
    expect(result.revenueDelta).toBeNull()
    expect(result.vehiclesDelta).toBeNull()
  })

  it('computes a real percent delta when the prior period had activity', () => {
    const orders = [
      order({ total: 200000, completedAt: TODAY.toISOString() }),
      order({ total: 100000, completedAt: yesterdayNoon }),
    ]
    const result = computePeriodKpis(orders, [], dayRange, prevDayRange)
    expect(result.revenueDelta).toBe(100)
  })

  it('counts new customers created in range vs the prior period', () => {
    const customers = [
      customer({ createdAt: TODAY.toISOString() }),
      customer({ createdAt: yesterdayNoon }),
    ]
    const result = computePeriodKpis([], customers, dayRange, prevDayRange)
    expect(result.newCustomers).toBe(1)
    expect(result.newCustomersDelta).toBe(0)
  })
})

describe('computeBayCapacity', () => {
  it('reports occupied/total and a rounded percentage', () => {
    const bays = [bay({ status: 'in-service' }), bay({ status: 'available' }), bay({ status: 'inspection' })]
    expect(computeBayCapacity(bays)).toEqual({ occupiedBays: 2, totalBays: 3, bayCapacityPct: 67 })
  })

  it('is 0% with no bays, not NaN', () => {
    expect(computeBayCapacity([]).bayCapacityPct).toBe(0)
  })
})

describe('buildBayStatusBoard', () => {
  it('resolves the vehicle label and worker name for an occupied bay', () => {
    const wo = order({ id: 'wo-1', vehicleId: 'veh-1' })
    const w = worker({ id: 'worker-1', name: 'Agus' })
    const b = bay({ status: 'in-service', currentWorkOrderId: 'wo-1', assignedWorkerId: 'worker-1' })
    const lookups = {
      workOrderById: new Map([['wo-1', wo]]),
      vehicleLabelOf: (id: string) => (id === 'veh-1' ? 'Toyota Avanza' : undefined),
      workerById: new Map([['worker-1', w]]),
    }
    const [row] = buildBayStatusBoard([b], lookups)
    expect(row.vehicleInfo).toBe('Toyota Avanza')
    expect(row.workerName).toBe('Agus')
  })

  it('leaves vehicleInfo/workerName undefined for an empty bay', () => {
    const lookups = { workOrderById: new Map(), vehicleLabelOf: () => undefined, workerById: new Map() }
    const [row] = buildBayStatusBoard([bay()], lookups)
    expect(row.vehicleInfo).toBeUndefined()
    expect(row.workerName).toBeUndefined()
  })
})

describe('buildTechnicianQueue', () => {
  const lookups = (wo?: WorkOrder) => ({
    workOrderById: wo ? new Map([[wo.id, wo]]) : new Map(),
    vehicleLabelOf: () => 'Toyota Avanza',
    workerById: new Map(),
  })

  it('reports overdue (-1) when the estimated end time has passed', () => {
    const w = worker({ id: 'w-1' })
    const b = bay({ status: 'in-service', assignedWorkerId: 'w-1', estimatedEndTime: new Date(TODAY.getTime() - 60000).toISOString() })
    const [row] = buildTechnicianQueue([w], [b], lookups(), TODAY)
    expect(row.minutesRemaining).toBe(-1)
  })

  it('reports a positive minute count before the estimated end time', () => {
    const w = worker({ id: 'w-1' })
    const b = bay({ status: 'in-service', assignedWorkerId: 'w-1', estimatedEndTime: new Date(TODAY.getTime() + 30 * 60000).toISOString() })
    const [row] = buildTechnicianQueue([w], [b], lookups(), TODAY)
    expect(row.minutesRemaining).toBe(30)
  })

  it('clamps progress to the 5-95 range', () => {
    const w = worker({ id: 'w-1' })
    const wo = order({ id: 'wo-1', createdAt: new Date(TODAY.getTime() - 59 * 60000).toISOString() })
    const b = bay({
      status: 'in-service',
      assignedWorkerId: 'w-1',
      currentWorkOrderId: 'wo-1',
      estimatedEndTime: new Date(TODAY.getTime() + 60000).toISOString(), // 59/60 min elapsed = 98%
    })
    const [row] = buildTechnicianQueue([w], [b], lookups(wo), TODAY)
    expect(row.progressPct).toBe(95)
  })

  it('reports null progress when estimatedEndTime is not after createdAt (guards div-by-zero/negative)', () => {
    const w = worker({ id: 'w-1' })
    const wo = order({ id: 'wo-1', createdAt: TODAY.toISOString() })
    const b = bay({
      status: 'in-service',
      assignedWorkerId: 'w-1',
      currentWorkOrderId: 'wo-1',
      estimatedEndTime: TODAY.toISOString(),
    })
    const [row] = buildTechnicianQueue([w], [b], lookups(wo), TODAY)
    expect(row.progressPct).toBeNull()
  })

  it('a worker with no assigned bay is available with no minutes/progress', () => {
    const [row] = buildTechnicianQueue([worker({ id: 'w-1' })], [], lookups(), TODAY)
    expect(row.status).toBe('available')
    expect(row.minutesRemaining).toBeNull()
    expect(row.progressPct).toBeNull()
  })
})

describe('computeServiceMix', () => {
  it('splits the description on " - " and counts only completed orders', () => {
    const orders = [
      order({ status: 'completed', items: [item({ description: 'Oil Change - Synthetic' })] }),
      order({ status: 'completed', items: [item({ description: 'Oil Change - Standard' })] }),
      order({ status: 'open', items: [item({ description: 'Oil Change - Synthetic' })] }),
    ]
    const mix = computeServiceMix(orders)
    expect(mix).toEqual([{ name: 'Oil Change', count: 2, share: 100 }])
  })

  it('respects the limit', () => {
    const orders = [1, 2, 3].map((n) => order({ status: 'completed', items: [item({ description: `Service ${n}` })] }))
    expect(computeServiceMix(orders, 2)).toHaveLength(2)
  })

  it('ignores product lines (productId set), counting service lines only', () => {
    const orders = [
      order({
        status: 'completed',
        items: [
          item({ description: 'Oil Change', productId: null }),
          item({ description: 'Engine Oil 5W-30', productId: 'p-1' }),
        ],
      }),
    ]
    expect(computeServiceMix(orders)).toEqual([{ name: 'Oil Change', count: 1, share: 100 }])
  })
})

describe('computeThroughput', () => {
  it('returns 7 days oldest-first, excluding cancelled appointments', () => {
    const appts = [
      appointment({ scheduledAt: TODAY.toISOString(), isWalkIn: false }),
      appointment({ scheduledAt: TODAY.toISOString(), isWalkIn: true }),
      appointment({ scheduledAt: TODAY.toISOString(), status: 'cancelled' }),
    ]
    const days = computeThroughput(appts, TODAY)
    expect(days).toHaveLength(7)
    expect(days[6].date.toDateString()).toBe(TODAY.toDateString())
    expect(days[6].scheduled).toBe(1)
    expect(days[6].walkIn).toBe(1)
  })
})

describe('computeRepeatCustomerBuckets', () => {
  it('counts a vehicle only from its second completed order onward, bucketed by week', () => {
    const orders = [
      order({ vehicleId: 'v-1', completedAt: new Date(2026, 5, 2).toISOString() }), // first visit, not a repeat
      order({ vehicleId: 'v-1', completedAt: new Date(2026, 5, 9).toISOString() }), // repeat, week 2 (day 9 -> index 1)
    ]
    const buckets = computeRepeatCustomerBuckets(orders, TODAY)
    expect(buckets.thisMonth[1]).toBe(1)
    expect(buckets.thisMonth.reduce((a, b) => a + b, 0)).toBe(1)
  })

  it('buckets last month separately from this month', () => {
    const orders = [
      order({ vehicleId: 'v-1', completedAt: new Date(2026, 4, 1).toISOString() }),
      order({ vehicleId: 'v-1', completedAt: new Date(2026, 4, 3).toISOString() }), // repeat, last month week 1
    ]
    const buckets = computeRepeatCustomerBuckets(orders, TODAY)
    expect(buckets.lastMonth[0]).toBe(1)
    expect(buckets.thisMonth.reduce((a, b) => a + b, 0)).toBe(0)
  })

  it('thisMonthTotal counts every completed order in the week — first-timers included', () => {
    const orders = [
      order({ vehicleId: 'v-1', completedAt: new Date(2026, 5, 9).toISOString() }),  // first visit
      order({ vehicleId: 'v-1', completedAt: new Date(2026, 5, 10).toISOString() }), // repeat
      order({ vehicleId: 'v-2', completedAt: new Date(2026, 5, 11).toISOString() }), // first visit, other vehicle
    ]
    const buckets = computeRepeatCustomerBuckets(orders, TODAY)
    expect(buckets.thisMonth[1]).toBe(1)
    expect(buckets.thisMonthTotal[1]).toBe(3)
  })
})

describe('computeAppointmentTrend', () => {
  it('counts non-cancelled appointments per month for the given year only', () => {
    const appts = [
      appointment({ scheduledAt: new Date(2026, 5, 1).toISOString() }),
      appointment({ scheduledAt: new Date(2026, 5, 20).toISOString() }),
      appointment({ scheduledAt: new Date(2026, 5, 5).toISOString(), status: 'cancelled' }),
      appointment({ scheduledAt: new Date(2025, 5, 5).toISOString() }), // wrong year
    ]
    const trend = computeAppointmentTrend(appts, TODAY)
    expect(trend).toHaveLength(12)
    expect(trend[5]).toEqual({ monthIndex: 5, appointments: 2 })
  })
})

describe('computeTodaysAppointments', () => {
  it('returns the day\'s non-cancelled appointments earliest-first, walk-ins included', () => {
    const appts = [
      appointment({ id: 'a-late', scheduledAt: new Date(2026, 5, 15, 15).toISOString() }),
      appointment({ id: 'a-early', scheduledAt: new Date(2026, 5, 15, 9).toISOString() }),
      appointment({ id: 'a-walkin', scheduledAt: new Date(2026, 5, 15, 11).toISOString(), isWalkIn: true }),
      appointment({ id: 'a-cancelled', scheduledAt: new Date(2026, 5, 15, 10).toISOString(), status: 'cancelled' }),
      appointment({ id: 'a-tomorrow', scheduledAt: new Date(2026, 5, 16, 9).toISOString() }),
    ]
    expect(computeTodaysAppointments(appts, TODAY).map((a) => a.id)).toEqual(['a-early', 'a-walkin', 'a-late'])
  })
})
