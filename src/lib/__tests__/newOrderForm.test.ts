// NewWorkOrderDialog's Quick Find and draft-to-payload rules, now that they
// live outside the component (see ../newOrderForm.ts's header for why).
import { describe, it, expect } from 'vitest'
import { quickFindVehicles, newOrderDraftToData, orderCreatedToast, type NewOrderDraft } from '../newOrderForm'
import type { Vehicle } from '../../store/vehicleStore'
import type { Customer } from '../../store/customerStore'
import type { Company } from '../../store/companyStore'

function vehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 'v-1',
    customerId: 'c-1',
    companyId: null,
    make: 'Toyota',
    model: 'Avanza',
    year: 2021,
    vin: 'VIN123',
    licensePlate: 'B 1234 XYZ',
    color: 'Silver',
    currentMileage: 10_000,
    engineType: '',
    engineSize: '',
    oilTypeRequired: '',
    oilCapacity: '',
    transmissionType: '',
    transmissionFluidType: '',
    driveType: '',
    differentialFluidType: '',
    notes: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    isDefault: false,
    ...overrides,
  }
}

function customer(overrides: Partial<Customer> = {}): Customer {
  return { id: 'c-1', name: 'Budi', phone: '0812', email: '', address: '', notes: '', createdAt: '2026-01-01T00:00:00.000Z', ...overrides }
}

function company(overrides: Partial<Company> = {}): Company {
  return {
    id: 'co-1',
    companyName: 'PT Jaya',
    contactPerson: '',
    phone: '',
    email: '',
    billingAddress: '',
    notes: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    drivers: [],
    ...overrides,
  }
}

describe('quickFindVehicles', () => {
  it('requires at least 2 characters', () => {
    expect(quickFindVehicles('b', [vehicle()], [customer()], [], 'No plate')).toEqual([])
  })

  it('matches by plate', () => {
    const results = quickFindVehicles('1234', [vehicle()], [customer()], [], 'No plate')
    expect(results).toHaveLength(1)
    expect(results[0].vehicleId).toBe('v-1')
  })

  it('matches by VIN', () => {
    const results = quickFindVehicles('vin123', [vehicle()], [customer()], [], 'No plate')
    expect(results).toHaveLength(1)
  })

  it('matches by owner name — customer', () => {
    const results = quickFindVehicles('budi', [vehicle()], [customer()], [], 'No plate')
    expect(results[0].ownerType).toBe('customer')
    expect(results[0].ownerLabel).toBe('Budi')
  })

  it('resolves a company-owned vehicle to its company name', () => {
    const v = vehicle({ customerId: null, companyId: 'co-1' })
    const results = quickFindVehicles('jaya', [v], [], [company()], 'No plate')
    expect(results[0]).toMatchObject({ ownerType: 'company', ownerId: 'co-1', ownerLabel: 'PT Jaya' })
  })

  it('excludes a vehicle whose owner record no longer exists', () => {
    const results = quickFindVehicles('1234', [vehicle()], [], [], 'No plate')
    expect(results).toEqual([])
  })

  it('falls back to the no-plate label when the vehicle has none', () => {
    const v = vehicle({ licensePlate: '' })
    const results = quickFindVehicles('budi', [v], [customer()], [], 'No plate label')
    expect(results[0].plate).toBe('No plate label')
  })

  it('caps results at the given limit', () => {
    const vehicles = Array.from({ length: 10 }, (_, i) => vehicle({ id: `v-${i}`, licensePlate: `PLATE ${i}` }))
    const results = quickFindVehicles('plate', vehicles, [customer()], [], 'No plate', 3)
    expect(results).toHaveLength(3)
  })
})

describe('newOrderDraftToData', () => {
  function draft(overrides: Partial<NewOrderDraft> = {}): NewOrderDraft {
    return { vehicleId: 'v-1', workerId: '', driverId: '', odometer: '', notes: '', ...overrides }
  }

  it('falls back to the vehicle\'s current mileage when odometer is left blank', () => {
    const data = newOrderDraftToData(draft(), 10, 12_000)
    expect(data.odometerAtArrival).toBe(12_000)
  })

  it('uses the typed odometer over the vehicle\'s current mileage', () => {
    const data = newOrderDraftToData(draft({ odometer: '15000' }), 10, 12_000)
    expect(data.odometerAtArrival).toBe(15_000)
  })

  it('maps blank worker/driver to null, not empty string', () => {
    const data = newOrderDraftToData(draft(), 10, null)
    expect(data.workerId).toBeNull()
    expect(data.driverId).toBeNull()
  })

  it('starts as an open, unpaid order with the shop\'s tax rate and no items', () => {
    const data = newOrderDraftToData(draft(), 8.25, null)
    expect(data.status).toBe('open')
    expect(data.paymentMethod).toBe('pending')
    expect(data.taxPercent).toBe(8.25)
    expect(data.items).toEqual([])
    expect(data.total).toBe(0)
  })
})

describe('orderCreatedToast', () => {
  const t = (key: string, vars?: Record<string, string | number>) => `${key}${vars ? `:${JSON.stringify(vars)}` : ''}`
  const tc = (key: string, count: number, vars?: Record<string, string | number>) => `${key}(${count})${vars ? `:${JSON.stringify(vars)}` : ''}`

  it('uses the plain "order created" description with no overdue lines added', () => {
    const toast = orderCreatedToast(1234, 0, t, tc)
    expect(toast).toEqual({
      tone: 'success',
      title: 'workOrders.orderCreatedTitle',
      description: 'workOrders.orderCreatedDescription:{"order":"SB-1234"}',
    })
  })

  it('uses the countable overdue-added description once anything was auto-added', () => {
    const toast = orderCreatedToast(1234, 1, t, tc)
    expect(toast.description).toBe('workOrders.overdueAutoAddedDescription(1):{"order":"SB-1234"}')
  })

  it('passes the plural count through for 2+', () => {
    const toast = orderCreatedToast(1234, 3, t, tc)
    expect(toast.description).toBe('workOrders.overdueAutoAddedDescription(3):{"order":"SB-1234"}')
  })
})
