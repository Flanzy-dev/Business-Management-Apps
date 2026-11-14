// Who an order is for once an order may have no car — a counter sale. The rules
// that matter: an order with a car is owned through the car (exactly as before),
// a counter sale is owned by the buyer named on it, and one that names nobody
// is a walk-in who must pay on the spot.
import { describe, it, expect } from 'vitest'
import type { WorkOrder } from '../../store/workOrderStore'
import type { Vehicle } from '../../store/vehicleStore'
import type { Customer } from '../../store/customerStore'
import type { Company } from '../../store/companyStore'
import { isCounterSale, orderOwnerRef, orderOwnerName, orderOwnerContact, orderVehicleLabel, canRecordUnpaid } from '../orders/orderOwner'

type OrderRef = Pick<WorkOrder, 'vehicleId' | 'customerId' | 'companyId'>

const sale = (overrides: Partial<OrderRef> = {}): OrderRef => ({ vehicleId: '', ...overrides })
const serviced = (overrides: Partial<OrderRef> = {}): OrderRef => ({ vehicleId: 'v-1', ...overrides })

const vehicle = { id: 'v-1', customerId: 'c-1', companyId: null, year: 2021, make: 'Toyota', model: 'Avanza', licensePlate: 'B 1234 XYZ' } as Vehicle
const vehicleById = new Map([[vehicle.id, vehicle]])
const customers = [
  { id: 'c-1', name: 'Budi', phone: '0811', email: 'budi@example.com' },
  { id: 'c-2', name: 'Sari', phone: '0822', email: '' },
] as Customer[]
const companies = [{ id: 'co-1', companyName: 'PT Maju', phone: '021', email: '' }] as Company[]

describe('isCounterSale', () => {
  it('is an order with no vehicle', () => {
    expect(isCounterSale(sale())).toBe(true)
    expect(isCounterSale(serviced())).toBe(false)
  })
})

describe('orderOwnerRef', () => {
  it('is the car\'s owner for an order with a car', () => {
    expect(orderOwnerRef(serviced(), vehicleById)).toEqual({ type: 'customer', id: 'c-1' })
  })

  it('ignores a buyer stored on an order that has a car — the car\'s owner wins', () => {
    expect(orderOwnerRef(serviced({ customerId: 'c-2' }), vehicleById)).toEqual({ type: 'customer', id: 'c-1' })
  })

  it('is the buyer named on a counter sale, customer or company', () => {
    expect(orderOwnerRef(sale({ customerId: 'c-2' }), vehicleById)).toEqual({ type: 'customer', id: 'c-2' })
    expect(orderOwnerRef(sale({ companyId: 'co-1' }), vehicleById)).toEqual({ type: 'company', id: 'co-1' })
  })

  it('is nobody for a counter sale that names no one', () => {
    expect(orderOwnerRef(sale(), vehicleById)).toBeNull()
  })
})

describe('orderOwnerName', () => {
  it('reads "Walk-in" for an anonymous counter sale, not "Unknown"', () => {
    expect(orderOwnerName(sale(), vehicleById, customers, companies)).toBe('Walk-in')
  })

  it('names the buyer of a counter sale', () => {
    expect(orderOwnerName(sale({ customerId: 'c-2' }), vehicleById, customers, companies)).toBe('Sari')
    expect(orderOwnerName(sale({ companyId: 'co-1' }), vehicleById, customers, companies)).toBe('PT Maju')
  })

  it('says so when the named buyer no longer resolves, rather than claiming a walk-in', () => {
    expect(orderOwnerName(sale({ customerId: 'gone' }), vehicleById, customers, companies)).not.toBe('Walk-in')
  })

  it('is unchanged for an order with a car', () => {
    expect(orderOwnerName(serviced(), vehicleById, customers, companies)).toBe('Budi')
  })
})

describe('orderOwnerContact', () => {
  it('reaches the car\'s owner, or the named buyer of a counter sale', () => {
    expect(orderOwnerContact(serviced(), vehicleById, customers, companies)).toEqual({ phone: '0811', email: 'budi@example.com' })
    expect(orderOwnerContact(sale({ customerId: 'c-2' }), vehicleById, customers, companies)).toEqual({ phone: '0822', email: '' })
  })

  it('is null for an anonymous counter sale — nobody to message', () => {
    expect(orderOwnerContact(sale(), vehicleById, customers, companies)).toBeNull()
  })
})

describe('orderVehicleLabel', () => {
  it('says "Counter sale" where a car would be named', () => {
    expect(orderVehicleLabel({ vehicleId: '' }, undefined)).toBe('Counter sale')
  })

  it('is the car\'s own label otherwise', () => {
    expect(orderVehicleLabel({ vehicleId: 'v-1' }, vehicle)).toContain('B 1234 XYZ')
  })
})

describe('canRecordUnpaid', () => {
  it('lets an order with a car be left unpaid — its owner is the debtor', () => {
    expect(canRecordUnpaid(serviced())).toBe(true)
  })

  it('refuses an anonymous counter sale — an invoice needs someone to send it to', () => {
    expect(canRecordUnpaid(sale())).toBe(false)
  })

  it('allows a counter sale once it names a customer or a company', () => {
    expect(canRecordUnpaid(sale({ customerId: 'c-2' }))).toBe(true)
    expect(canRecordUnpaid(sale({ companyId: 'co-1' }))).toBe(true)
  })
})
