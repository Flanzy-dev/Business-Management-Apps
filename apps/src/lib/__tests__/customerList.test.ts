import { describe, expect, it } from 'vitest'
import { buildCustomerRows, filterCustomerRows, nextCustomerSort, sortCustomerRows } from '../customers/customerList'
import type { Customer } from '../../store/customerStore'
import type { Vehicle } from '../../store/vehicleStore'
import type { WorkOrder } from '../../store/workOrderStore'

const customer = (id: string, name: string, phone = ''): Customer => ({ id, name, phone, email: '', address: '' }) as Customer
const vehicle = (id: string, customerId: string | null, licensePlate: string, companyId: string | null = null): Vehicle =>
  ({ id, customerId, companyId, licensePlate }) as Vehicle
const order = (vehicleId: string, date: string, status: WorkOrder['status'] = 'completed'): WorkOrder =>
  ({ id: `${vehicleId}-${date}`, vehicleId, date, status }) as WorkOrder

const customers = [customer('c1', 'Budi', '0812'), customer('c2', 'Ani'), customer('c3', 'Citra')]
const vehicles = [
  vehicle('v1', 'c1', 'H 4321 AB'),
  vehicle('v2', 'c1', 'B 22 AB'),
  vehicle('v3', 'c2', 'D 7 X'),
  vehicle('v4', null, 'L 9 Z', 'co1'),
]
const orders = [
  order('v1', '2026-03-01T00:00:00.000Z'),
  order('v2', '2026-05-01T00:00:00.000Z'),
  order('v3', '2026-04-01T00:00:00.000Z'),
  order('v3', '2026-09-01T00:00:00.000Z', 'open'),
]

describe('buildCustomerRows', () => {
  it('collects each customer\'s plates and latest completed visit', () => {
    const rows = buildCustomerRows(customers, vehicles, orders)
    expect(rows.map((r) => [r.customer.id, r.plates, r.lastVisit])).toEqual([
      ['c1', ['H 4321 AB', 'B 22 AB'], '2026-05-01T00:00:00.000Z'],
      ['c2', ['D 7 X'], '2026-04-01T00:00:00.000Z'],
      ['c3', [], null],
    ])
  })
})

describe('filterCustomerRows', () => {
  const rows = buildCustomerRows(customers, vehicles, orders)
  it('finds a customer by plate, ignoring spacing and case', () => {
    expect(filterCustomerRows(rows, 'h4321').map((r) => r.customer.id)).toEqual(['c1'])
  })
  it('still matches name and phone', () => {
    expect(filterCustomerRows(rows, 'ani').map((r) => r.customer.id)).toEqual(['c2'])
    expect(filterCustomerRows(rows, '0812').map((r) => r.customer.id)).toEqual(['c1'])
  })
  it('keeps everything for a blank query', () => {
    expect(filterCustomerRows(rows, '  ')).toHaveLength(3)
  })

  describe('words, phones and typos', () => {
    const people = [customer('p1', 'Budi Santoso', '0812-555-1000'), customer('p2', 'Santosa Wijaya', '0813-1'), customer('p3', 'Ani Dewi')]
    const peopleRows = buildCustomerRows(people, [vehicle('pv1', 'p1', 'H 4321 AB')], [])
    const ids = (q: string) => filterCustomerRows(peopleRows, q).map((r) => r.customer.id)

    it('finds first and last name in the other order', () => {
      expect(ids('santoso budi')).toEqual(['p1'])
    })

    it('finds a phone typed without its dashes', () => {
      expect(ids('08125551000')).toEqual(['p1'])
    })

    it('finds a customer by name and plate together', () => {
      expect(ids('budi h4321')).toEqual(['p1'])
    })

    it('shows a near-miss spelling only when nothing matched exactly (the table is sorted by column)', () => {
      expect(ids('santoso')).toEqual(['p1'])
      expect(ids('dewo')).toEqual(['p3'])
    })
  })
})

describe('sortCustomerRows', () => {
  const rows = buildCustomerRows(customers, vehicles, orders)
  it('sorts by name, vehicle count and last visit', () => {
    expect(sortCustomerRows(rows, { key: 'name', direction: 'asc' }).map((r) => r.customer.name)).toEqual(['Ani', 'Budi', 'Citra'])
    expect(sortCustomerRows(rows, { key: 'vehicles', direction: 'desc' }).map((r) => r.customer.name)).toEqual(['Budi', 'Ani', 'Citra'])
    expect(sortCustomerRows(rows, { key: 'lastVisit', direction: 'desc' }).map((r) => r.customer.name)).toEqual(['Budi', 'Ani', 'Citra'])
  })
  it('starts a new column A–Z for name, newest/biggest first otherwise, and flips the active one', () => {
    const byName = { key: 'name', direction: 'asc' } as const
    expect(nextCustomerSort(byName, 'name')).toEqual({ key: 'name', direction: 'desc' })
    expect(nextCustomerSort(byName, 'lastVisit')).toEqual({ key: 'lastVisit', direction: 'desc' })
  })
})
