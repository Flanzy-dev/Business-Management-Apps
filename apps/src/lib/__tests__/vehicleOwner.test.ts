import { describe, it, expect } from 'vitest'
import {
  ownerOf,
  ownerRefKey,
  ownerFields,
  isOwnedBy,
  vehiclesOf,
  defaultVehicleOf,
  findOwner,
} from '../vehicles/vehicleOwner'

const dir = {
  customers: [{ id: 'c-1', name: 'ANTO', phone: '0812', email: 'a@x' }],
  companies: [{ id: 'k-1', companyName: 'PT. MAJU JAYA', phone: '024' }],
}

describe('ownerOf', () => {
  it('reads a customer, a company, or no owner', () => {
    expect(ownerOf({ customerId: 'c-1', companyId: null })).toEqual({ type: 'customer', id: 'c-1' })
    expect(ownerOf({ customerId: null, companyId: 'k-1' })).toEqual({ type: 'company', id: 'k-1' })
    expect(ownerOf({ customerId: null, companyId: null })).toBeNull()
    expect(ownerOf(undefined)).toBeNull()
  })

  it('lets the customer win if a row ever carries both (the rule every caller used)', () => {
    expect(ownerOf({ customerId: 'c-1', companyId: 'k-1' })).toEqual({ type: 'customer', id: 'c-1' })
  })
})

describe('ownerRefKey / ownerFields', () => {
  it('keys a customer and a company with the same id apart', () => {
    expect(ownerRefKey({ type: 'customer', id: 'x' })).not.toBe(ownerRefKey({ type: 'company', id: 'x' }))
  })

  it('writes exactly one of the two ids, or neither', () => {
    expect(ownerFields({ type: 'company', id: 'k-1' })).toEqual({ customerId: null, companyId: 'k-1' })
    expect(ownerFields({ type: 'customer', id: '' })).toEqual({ customerId: null, companyId: null })
    expect(ownerFields(null)).toEqual({ customerId: null, companyId: null })
  })
})

describe('vehicle lookups', () => {
  const vehicles = [
    { id: 'v-1', customerId: 'c-1', companyId: null },
    { id: 'v-2', customerId: null, companyId: 'c-1', isDefault: true }, // same id string, other kind
    { id: 'v-3', customerId: 'c-1', companyId: null, isDefault: true },
  ]

  it('never mixes a customer up with a company that has the same id', () => {
    expect(vehiclesOf(vehicles, { type: 'customer', id: 'c-1' }).map((v) => v.id)).toEqual(['v-1', 'v-3'])
    expect(isOwnedBy(vehicles[1], { type: 'customer', id: 'c-1' })).toBe(false)
  })

  it("finds the owner's default vehicle", () => {
    expect(defaultVehicleOf(vehicles, { type: 'customer', id: 'c-1' })?.id).toBe('v-3')
  })

  it('has no vehicles for an empty owner id', () => {
    expect(vehiclesOf(vehicles, { type: 'customer', id: '' })).toEqual([])
  })
})

describe('findOwner', () => {
  it('flattens either kind to name/phone/email', () => {
    expect(findOwner({ type: 'customer', id: 'c-1' }, dir)).toEqual({ type: 'customer', id: 'c-1', name: 'ANTO', phone: '0812', email: 'a@x' })
    expect(findOwner({ type: 'company', id: 'k-1' }, dir)).toEqual({ type: 'company', id: 'k-1', name: 'PT. MAJU JAYA', phone: '024', email: '' })
  })

  it('is undefined for no owner or an id that no longer resolves', () => {
    expect(findOwner(null, dir)).toBeUndefined()
    expect(findOwner({ type: 'company', id: 'gone' }, dir)).toBeUndefined()
  })
})
