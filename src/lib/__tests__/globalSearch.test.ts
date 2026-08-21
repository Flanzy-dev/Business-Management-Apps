import { describe, it, expect } from 'vitest'
import type { Vehicle } from '../../store/vehicleStore'
import type { Customer } from '../../store/customerStore'
import type { Company } from '../../store/companyStore'
import type { WorkOrder, WorkOrderItem } from '../../store/workOrderStore'
import type { ScheduleRule } from '../../store/scheduleRuleStore'
import { buildSearchResults, type SearchData, type VehicleSearchResult, type WorkOrderSearchResult } from '../globalSearch'

let nextId = 1
const NOW = new Date(2026, 5, 15)

function vehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: `veh-${nextId++}`,
    customerId: 'cust-1',
    companyId: null,
    make: 'Toyota',
    model: 'Avanza',
    year: 2020,
    vin: 'JT123456789',
    licensePlate: 'B 1234 XYZ',
    color: '',
    currentMileage: 40000,
    engineType: '',
    engineSize: '',
    oilTypeRequired: '',
    oilCapacity: '',
    transmissionType: '',
    transmissionFluidType: '',
    driveType: '',
    differentialFluidType: '',
    notes: '',
    createdAt: NOW.toISOString(),
    ...overrides,
  }
}

function customer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: `cust-${nextId++}`,
    name: 'Budi Santoso',
    phone: '0812345678',
    email: '',
    address: '',
    notes: '',
    createdAt: NOW.toISOString(),
    ...overrides,
  }
}

function company(overrides: Partial<Company> = {}): Company {
  return {
    id: `co-${nextId++}`,
    companyName: 'Fleet Logistik Jaya',
    contactPerson: '',
    phone: '',
    email: '',
    billingAddress: '',
    notes: '',
    createdAt: NOW.toISOString(),
    drivers: [],
    ...overrides,
  }
}

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
    vehicleId: 'veh-1',
    workerId: null,
    driverId: null,
    odometerAtArrival: null,
    odometerAtService: null,
    date: '2026-06-01',
    items: [],
    subtotal: 0,
    discountAmount: 0,
    taxPercent: 0,
    taxAmount: 0,
    total: 0,
    paymentMethod: 'cash',
    status: 'completed',
    notes: '',
    createdAt: NOW.toISOString(),
    completedAt: NOW.toISOString(),
    ...overrides,
  }
}

function rule(overrides: Partial<ScheduleRule> = {}): ScheduleRule {
  return {
    id: `rule-${nextId++}`,
    vehicleId: 'veh-1',
    itemTypeId: 'oli-mesin',
    intervalKm: 5000,
    baseOdometer: 35000,
    source: 'workshop_default',
    supersededAt: null,
    supersedesId: null,
    notes: '',
    createdAt: NOW.toISOString(),
    ...overrides,
  }
}

function data(overrides: Partial<SearchData> = {}): SearchData {
  return { vehicles: [], customers: [], companies: [], workOrders: [], scheduleRules: [], ...overrides }
}

describe('buildSearchResults', () => {
  it('returns nothing below the 2-character minimum', () => {
    expect(buildSearchResults('B', data({ vehicles: [vehicle({ licensePlate: 'B 1234 XYZ' })] }))).toEqual([])
  })

  it('matches a vehicle by plate', () => {
    const v = vehicle({ licensePlate: 'B 1234 XYZ' })
    const results = buildSearchResults('1234', data({ vehicles: [v] }), NOW)
    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({ type: 'vehicle', id: v.id })
  })

  it('matches a vehicle by VIN', () => {
    const v = vehicle({ vin: 'JT987654321' })
    const results = buildSearchResults('987654', data({ vehicles: [v] }), NOW)
    expect(results).toHaveLength(1)
  })

  it('matches a vehicle by its owning customer\'s name', () => {
    const cust = customer({ id: 'cust-1', name: 'Budi Santoso' })
    const v = vehicle({ customerId: 'cust-1', companyId: null, licensePlate: 'B 1234 XYZ' })
    // The customer itself also matches on the same query (existing
    // behavior) — the point here is the vehicle now matches too.
    const results = buildSearchResults('budi', data({ vehicles: [v], customers: [cust] }), NOW)
    const match = results.find((r) => r.type === 'vehicle')
    expect(match).toMatchObject({ type: 'vehicle', id: v.id })
  })

  it('matches a vehicle by its owning company\'s name, and reports that company as the owner', () => {
    const co = company({ id: 'co-1', companyName: 'Fleet Logistik Jaya' })
    const v = vehicle({ customerId: null, companyId: 'co-1', licensePlate: 'B 9999 ZZZ' })
    const [result] = buildSearchResults(
      'logistik',
      data({ vehicles: [v], companies: [co] }),
      NOW
    ) as [VehicleSearchResult]
    expect(result).toMatchObject({ type: 'vehicle', id: v.id })
    // Guards the display bug this reuse also fixed: a fleet vehicle used to
    // always report ownerName: null (hand-rolled lookup only checked
    // customerId), rendering as "No owner" regardless of its real company.
    expect(result.ownerName).toBe('Fleet Logistik Jaya')
  })

  it('does not match an ownerless vehicle against generic fallback words like "unknown" or "no owner"', () => {
    const v = vehicle({ customerId: null, companyId: null, licensePlate: 'B 1111 AAA' })
    expect(buildSearchResults('unknown', data({ vehicles: [v] }), NOW)).toEqual([])
    expect(buildSearchResults('no owner', data({ vehicles: [v] }), NOW)).toEqual([])
  })

  it('matches a customer by name or phone', () => {
    const byName = buildSearchResults('Budi', data({ customers: [customer({ name: 'Budi Santoso' })] }))
    expect(byName).toHaveLength(1)
    expect(byName[0]).toMatchObject({ type: 'customer' })

    const byPhone = buildSearchResults('812345', data({ customers: [customer({ phone: '0812345678' })] }))
    expect(byPhone).toHaveLength(1)
  })

  it('matches a work order by order number', () => {
    const wo = order({ orderNumber: 1042 })
    const results = buildSearchResults('1042', data({ workOrders: [wo] }))
    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({ type: 'workorder', orderNumber: 1042 })
  })

  it('matches a work order by its vehicle\'s owning customer\'s name', () => {
    const cust = customer({ id: 'cust-1', name: 'Budi Santoso' })
    const v = vehicle({ id: 'veh-1', customerId: 'cust-1', companyId: null })
    const wo = order({ vehicleId: 'veh-1', orderNumber: 2001 })
    const results = buildSearchResults('budi', data({ vehicles: [v], customers: [cust], workOrders: [wo] }), NOW)
    const match = results.find((r) => r.type === 'workorder') as WorkOrderSearchResult | undefined
    expect(match).toMatchObject({ orderNumber: 2001 })
  })

  it('matches a work order by its vehicle\'s owning company\'s name', () => {
    const co = company({ id: 'co-1', companyName: 'Fleet Logistik Jaya' })
    const v = vehicle({ id: 'veh-1', customerId: null, companyId: 'co-1' })
    const wo = order({ vehicleId: 'veh-1', orderNumber: 2002 })
    const results = buildSearchResults('logistik', data({ vehicles: [v], companies: [co], workOrders: [wo] }), NOW)
    const match = results.find((r) => r.type === 'workorder') as WorkOrderSearchResult | undefined
    expect(match).toMatchObject({ orderNumber: 2002 })
  })

  it('a vehicle overdue by km reports overdue — the regression the old "+3 months" guess caused', () => {
    const v = vehicle({ id: 'veh-1', licensePlate: 'B 1234 XYZ', currentMileage: 41000 })
    const rules = [rule({ vehicleId: 'veh-1', baseOdometer: 35000, intervalKm: 5000 })] // due at 40000, now 41000
    const [result] = buildSearchResults('1234', data({ vehicles: [v], scheduleRules: rules }), NOW) as [VehicleSearchResult]
    expect(result.dueStatus).toEqual({ kind: 'scheduled', tone: 'overdue', lines: expect.any(Array) })
  })

  it('a vehicle with no schedule rules reports no_schedule, not an invented date', () => {
    const v = vehicle({ id: 'veh-1', licensePlate: 'B 1234 XYZ' })
    const [result] = buildSearchResults('1234', data({ vehicles: [v] }), NOW) as [VehicleSearchResult]
    expect(result.dueStatus).toEqual({ kind: 'no_schedule' })
  })

  it('reads odometer from the last order, not the vehicle current mileage', () => {
    const v = vehicle({ id: 'veh-1', licensePlate: 'B 1234 XYZ', currentMileage: 50000 })
    const wo = order({ vehicleId: 'veh-1', odometerAtService: 38000 })
    const [result] = buildSearchResults('1234', data({ vehicles: [v], workOrders: [wo] }), NOW) as [VehicleSearchResult]
    expect(result.odometerAtLastService).toBe(38000)
  })

  it('falls back to odometerAtArrival when odometerAtService is unset', () => {
    const v = vehicle({ id: 'veh-1', licensePlate: 'B 1234 XYZ' })
    const wo = order({ vehicleId: 'veh-1', odometerAtArrival: 37000, odometerAtService: null })
    const [result] = buildSearchResults('1234', data({ vehicles: [v], workOrders: [wo] }), NOW) as [VehicleSearchResult]
    expect(result.odometerAtLastService).toBe(37000)
  })

  it('reports null odometer (not the vehicle current mileage) when the last order has neither reading', () => {
    const v = vehicle({ id: 'veh-1', licensePlate: 'B 1234 XYZ', currentMileage: 50000 })
    const wo = order({ vehicleId: 'veh-1', odometerAtArrival: null, odometerAtService: null })
    const [result] = buildSearchResults('1234', data({ vehicles: [v], workOrders: [wo] }), NOW) as [VehicleSearchResult]
    expect(result.odometerAtLastService).toBeNull()
  })

  it('picks the serviceItemTypeId off the last order tagged line, ignoring untagged lines', () => {
    const v = vehicle({ id: 'veh-1', licensePlate: 'B 1234 XYZ' })
    const wo = order({
      vehicleId: 'veh-1',
      items: [item({ serviceItemTypeId: null }), item({ serviceItemTypeId: 'oli-mesin' })],
    })
    const [result] = buildSearchResults('1234', data({ vehicles: [v], workOrders: [wo] }), NOW) as [VehicleSearchResult]
    expect(result.serviceItemTypeId).toBe('oli-mesin')
  })

  it('only considers completed orders for last-service data', () => {
    const v = vehicle({ id: 'veh-1', licensePlate: 'B 1234 XYZ' })
    const wo = order({ vehicleId: 'veh-1', status: 'open', completedAt: null, odometerAtService: 39000 })
    const [result] = buildSearchResults('1234', data({ vehicles: [v], workOrders: [wo] }), NOW) as [VehicleSearchResult]
    expect(result.lastServiceAt).toBeNull()
    expect(result.odometerAtLastService).toBeNull()
  })
})
