// NewWorkOrderDialog's Quick Find and draft-to-payload rules, now that they
// live outside the component (see ../newOrderForm.ts's header for why).
import { describe, it, expect } from 'vitest'
import { quickFindVehicles, newOrderDraftToData, orderCreatedToast, openOrderForVehicle, type NewOrderDraft } from '../orders/newOrderForm'
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

describe('openOrderForVehicle', () => {
  const order = (id: string, vehicleId: string, status: string, createdAt: string) => ({ id, vehicleId, status: status as 'open', createdAt })

  it('finds the vehicle\'s open order', () => {
    const orders = [order('a', 'v-1', 'open', '2026-08-01T08:00:00.000Z'), order('b', 'v-2', 'open', '2026-08-01T09:00:00.000Z')]
    expect(openOrderForVehicle(orders, 'v-1')?.id).toBe('a')
  })

  it('ignores completed and voided orders — only a car on the lift counts', () => {
    const orders = [order('a', 'v-1', 'completed', '2026-08-01T08:00:00.000Z'), order('b', 'v-1', 'cancelled', '2026-08-01T09:00:00.000Z')]
    expect(openOrderForVehicle(orders, 'v-1')).toBeUndefined()
  })

  it('returns the newest when more than one is open', () => {
    const orders = [order('old', 'v-1', 'open', '2026-08-01T08:00:00.000Z'), order('new', 'v-1', 'open', '2026-08-01T10:00:00.000Z')]
    expect(openOrderForVehicle(orders, 'v-1')?.id).toBe('new')
  })

  it('finds nothing without a vehicle', () => {
    expect(openOrderForVehicle([order('a', 'v-1', 'open', '2026-08-01T08:00:00.000Z')], '')).toBeUndefined()
  })
})

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

  describe('owner words, in any order', () => {
    const budi = customer({ id: 'c-1', name: 'Budi Santoso', phone: '0812 555 1000' })
    const sari = customer({ id: 'c-2', name: 'Sari Dewi', phone: '0813 999 2000' })
    const cars = [
      vehicle({ id: 'v-budi', customerId: 'c-1', licensePlate: 'B 1234 XYZ', vin: '' }),
      vehicle({ id: 'v-sari', customerId: 'c-2', licensePlate: 'D 5678 AB', vin: '', model: 'Brio', make: 'Honda' }),
    ]
    const ids = (q: string) => quickFindVehicles(q, cars, [budi, sari], [], 'No plate').map((r) => r.vehicleId)

    it('finds a car by owner name and plate digits together', () => {
      expect(ids('budi 1234')).toEqual(['v-budi'])
      expect(ids('1234 budi')).toEqual(['v-budi'])
    })

    it('finds a car by first and last name in the other order', () => {
      expect(ids('santoso budi')).toEqual(['v-budi'])
    })

    it('finds a car by the owner phone number', () => {
      expect(ids('0813 999')).toEqual(['v-sari'])
    })

    it('finds a car by owner and model', () => {
      expect(ids('sari brio')).toEqual(['v-sari'])
    })

    it('does not mix owners up', () => {
      expect(ids('budi 5678')).toEqual([])
    })

    it('finds a car when the owner name is spelled a little differently', () => {
      expect(ids('santosa')).toEqual(['v-budi'])
    })

    it('ranks an exactly spelled owner above a near-miss one', () => {
      const near = customer({ id: 'c-3', name: 'Santosa Budi', phone: '' })
      const two = [vehicle({ id: 'v-near', customerId: 'c-3', licensePlate: 'F 1 A', vin: '' }), cars[0]]
      expect(quickFindVehicles('santoso', two, [budi, near], [], 'No plate').map((r) => r.vehicleId)).toEqual(['v-budi', 'v-near'])
    })
  })

  describe('ranking', () => {
    const owners = [customer({ id: 'c-1', name: 'Budi' }), customer({ id: 'c-2', name: 'Sari' })]
    const car = (id: string, plate: string, ownerId = 'c-1', over: Partial<Vehicle> = {}) =>
      vehicle({ id, licensePlate: plate, customerId: ownerId, vin: '', ...over })
    const ids = (q: string, vehicles: Vehicle[], customers = owners) =>
      quickFindVehicles(q, vehicles, customers, [], 'No plate').map((r) => r.vehicleId)

    it('puts the exact plate first, even when earlier cars match more loosely', () => {
      const vehicles = [
        car('contains', 'AB 1234 ZZ'), // …B1234… sits inside
        car('prefix', 'B 1234 XYZ'), // starts with B1234
        car('exact', 'B 1234'), // is B1234
      ]
      expect(ids('b1234', vehicles)).toEqual(['exact', 'prefix', 'contains'])
    })

    it('orders a plate that STARTS with the typed text before one that merely contains it', () => {
      const vehicles = [car('contains', 'D 91234 AB'), car('prefix', '1234 XYZ')]
      expect(ids('1234', vehicles)).toEqual(['prefix', 'contains'])
    })

    it('puts the digits a counter hand types at the start of the number segment ahead of the same digits buried mid-number', () => {
      const vehicles = [car('buried', 'D 91234 AB'), car('number-segment', 'B 1234 XYZ')]
      expect(ids('1234', vehicles)).toEqual(['number-segment', 'buried'])
    })

    it('treats spacing and case in the typed plate as irrelevant', () => {
      const vehicles = [car('x', 'H 4321 AB')]
      expect(ids('h4321ab', vehicles)).toEqual(['x'])
      expect(ids('H 4321 ab', vehicles)).toEqual(['x'])
    })

    it('ranks a plate hit above a VIN hit above an owner-name hit', () => {
      const vehicles = [
        car('by-owner', 'Z 1 Z', 'c-2'), // owner "Sari"
        car('by-vin', 'Z 2 Z', 'c-1', { vin: 'XSARI0001' }),
        car('by-plate', 'SARI 3'),
      ]
      expect(ids('sari', vehicles)).toEqual(['by-plate', 'by-vin', 'by-owner'])
    })

    it('ranks an owner whose name STARTS with the query above one that merely contains it', () => {
      const people = [customer({ id: 'c-1', name: 'Pak Budi' }), customer({ id: 'c-2', name: 'Budiman' })]
      const vehicles = [car('contains', 'Q 1 Q', 'c-1'), car('starts', 'Q 2 Q', 'c-2')]
      expect(ids('budi', vehicles, people)).toEqual(['starts', 'contains'])
    })

    it('keeps the list order between equally good matches', () => {
      const vehicles = [car('first', 'P 100 A'), car('second', 'P 101 A'), car('third', 'P 102 A')]
      expect(ids('p10', vehicles)).toEqual(['first', 'second', 'third'])
    })

    it('still finds the best match when it sits far down a long list', () => {
      const many = Array.from({ length: 200 }, (_, i) => car(`v-${i}`, `K ${i} FILL`, 'c-2'))
      many.push(car('target', 'B 7777 KL'))
      expect(ids('b7777kl', many)).toEqual(['target'])
    })
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

  it('leaves the buyer off an order that has a car — the car\'s owner is the customer', () => {
    const data = newOrderDraftToData(draft({ customerId: 'c-9' }), 10, 12_000)
    expect(data).not.toHaveProperty('customerId')
    expect(data).not.toHaveProperty('companyId')
  })

  describe('a counter sale (no vehicle)', () => {
    const sale = (overrides: Partial<NewOrderDraft> = {}) => draft({ vehicleId: '', ...overrides })

    it('carries no vehicle, no odometer and no fleet driver', () => {
      // Whatever was typed before the vehicle was cleared must not leak onto the sale.
      const data = newOrderDraftToData(sale({ odometer: '15000', driverId: 'd-1' }), 10, 12_000)
      expect(data.vehicleId).toBe('')
      expect(data.odometerAtArrival).toBeNull()
      expect(data.driverId).toBeNull()
    })

    it('records the named customer, and only the customer', () => {
      expect(newOrderDraftToData(sale({ customerId: 'c-2' }), 10, null)).toMatchObject({ customerId: 'c-2', companyId: null })
    })

    it('records the named company, and only the company', () => {
      expect(newOrderDraftToData(sale({ companyId: 'co-1' }), 10, null)).toMatchObject({ customerId: null, companyId: 'co-1' })
    })

    it('records no buyer for a walk-in', () => {
      expect(newOrderDraftToData(sale(), 10, null)).toMatchObject({ customerId: null, companyId: null })
    })

    it('still starts open, unpaid, at the shop\'s tax rate', () => {
      const data = newOrderDraftToData(sale(), 8.25, null)
      expect(data).toMatchObject({ status: 'open', paymentMethod: 'pending', taxPercent: 8.25, items: [] })
    })
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
