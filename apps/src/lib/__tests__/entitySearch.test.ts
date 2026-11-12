import { describe, it, expect } from 'vitest'
import { filterBySearch, filterVehiclesBySearch } from '../format/entitySearch'

interface Row {
  name: string
  phone: string
}

const rows: Row[] = [
  { name: 'Budi Santoso', phone: '0812-3456-7890' },
  { name: 'siti aminah', phone: '0899-0000-1111' },
]

describe('filterBySearch', () => {
  it('returns every item for a blank query', () => {
    expect(filterBySearch(rows, '', (r) => [r.name, r.phone])).toEqual(rows)
    expect(filterBySearch(rows, '   ', (r) => [r.name, r.phone])).toEqual(rows)
  })

  it('matches case-insensitively on every listed field, not just the first', () => {
    expect(filterBySearch(rows, 'BUDI', (r) => [r.name, r.phone])).toEqual([rows[0]])
    expect(filterBySearch(rows, 'AMINAH', (r) => [r.name, r.phone])).toEqual([rows[1]])
  })

  it('matches phone case-insensitively — the drift the five hand-written filters disagreed on', () => {
    // Phone numbers are digits/dashes so case never actually matters for them,
    // but the field is passed through the same lowercasing as every other
    // field here rather than being special-cased, which is the actual fix:
    // four of the five original filters case-folded name/email but compared
    // phone with a bare `.includes(search)`.
    expect(filterBySearch(rows, '3456', (r) => [r.name, r.phone])).toEqual([rows[0]])
  })

  it('tolerates null/undefined fields without throwing', () => {
    const withGaps: { name: string; email: string | null }[] = [{ name: 'X', email: null }]
    expect(filterBySearch(withGaps, 'x', (r) => [r.name, r.email])).toEqual(withGaps)
    expect(filterBySearch(withGaps, 'nothing', (r) => [r.name, r.email])).toEqual([])
  })

  it('matches if any field matches, not requiring all', () => {
    expect(filterBySearch(rows, 'santoso', (r) => [r.name, r.phone])).toEqual([rows[0]])
  })

  it('takes words in any order, across fields', () => {
    expect(filterBySearch(rows, 'santoso budi', (r) => [r.name, r.phone])).toEqual([rows[0]])
  })

  it('falls back to a near-miss spelling only when nothing matched exactly', () => {
    expect(filterBySearch(rows, 'santosa', (r) => [r.name, r.phone])).toEqual([rows[0]])
    expect(filterBySearch(rows, 'zzzzzz', (r) => [r.name, r.phone])).toEqual([])
  })
})

describe('filterVehiclesBySearch', () => {
  const car = { make: 'Toyota', model: 'Avanza', vin: 'MHKA1BA1JGK123456', licensePlate: 'H 4321 AB' }
  const other = { make: 'Honda', model: 'Brio', vin: '', licensePlate: 'B 9999 ZZ' }
  const vehicles = [car, other]

  it('returns everything for a blank query', () => {
    expect(filterVehiclesBySearch(vehicles, '   ')).toEqual(vehicles)
  })

  it('finds a stored plate however the query spaces or cases it', () => {
    // Plates are stored as "H 4321 AB"; a plain substring check misses the first two.
    expect(filterVehiclesBySearch(vehicles, 'h4321ab')).toEqual([car])
    expect(filterVehiclesBySearch(vehicles, 'H4321')).toEqual([car])
    expect(filterVehiclesBySearch(vehicles, 'h 4321')).toEqual([car])
  })

  it('still matches make, model and VIN as plain substrings', () => {
    expect(filterVehiclesBySearch(vehicles, 'avanza')).toEqual([car])
    expect(filterVehiclesBySearch(vehicles, 'HONDA')).toEqual([other])
    expect(filterVehiclesBySearch(vehicles, 'a1ba1jgk')).toEqual([car])
  })

  it('matches nothing for a query that is in no field', () => {
    expect(filterVehiclesBySearch(vehicles, 'zzzz0000')).toEqual([])
  })

  describe('by owner', () => {
    const owners = new Map<unknown, string>([
      [car, 'Budi Santoso 0812 555 1000'],
      [other, 'Sari Dewi 0813 999 2000'],
    ])
    const ownerText = (v: unknown) => owners.get(v) ?? ''

    it('finds the car by its owner name', () => {
      expect(filterVehiclesBySearch(vehicles, 'budi', ownerText)).toEqual([car])
    })

    it('finds it by owner name together with plate digits or model, in any order', () => {
      expect(filterVehiclesBySearch(vehicles, 'budi 4321', ownerText)).toEqual([car])
      expect(filterVehiclesBySearch(vehicles, 'avanza santoso', ownerText)).toEqual([car])
    })

    it('finds it by the owner phone number', () => {
      expect(filterVehiclesBySearch(vehicles, '0813', ownerText)).toEqual([other])
    })

    it('does not cross an owner with another owner\'s car', () => {
      expect(filterVehiclesBySearch(vehicles, 'sari 4321', ownerText)).toEqual([])
    })

    it('finds the car when the name is spelled a little differently, after exact hits', () => {
      expect(filterVehiclesBySearch(vehicles, 'santosa', ownerText)).toEqual([car])
      const budiToo = { ...other, licensePlate: 'D 1 A' }
      const both = [car, budiToo]
      const text = new Map<unknown, string>([[car, 'Budi Santosa'], [budiToo, 'Ani Santoso']])
      // "santoso" is exact for the second car and a near miss for the first.
      expect(filterVehiclesBySearch(both, 'santoso', (v) => text.get(v) ?? '')).toEqual([budiToo, car])
    })

    it('without an owner lookup behaves as before', () => {
      expect(filterVehiclesBySearch(vehicles, 'budi')).toEqual([])
    })
  })
})
