import { describe, it, expect, beforeEach } from 'vitest'
import { useLanguageStore } from '../../store/languageStore'
import {
  isBuiltinProductCategory,
  isBuiltinServiceItemType,
  productCategoryLabel,
  serviceItemTypeLabel,
  expenseCategoryLabel,
  appointmentOwnerName,
  vehicleSpecGroups,
  itemTypeNameLookup,
  intervalAxisOf,
} from '../entities'
import type { Vehicle } from '../../store/vehicleStore'
import type { Customer } from '../../store/customerStore'
import type { Company } from '../../store/companyStore'

beforeEach(() => {
  useLanguageStore.getState().setLanguage('en')
})

describe('serviceItemTypeLabel', () => {
  it('translates a built-in item type into the current language', () => {
    expect(serviceItemTypeLabel('Oli Mesin')).toBe('Engine Oil')
    useLanguageStore.getState().setLanguage('id')
    expect(serviceItemTypeLabel('Oli Mesin')).toBe('Oli Mesin')
  })

  it("shows a shop's own item type exactly as typed, in every language", () => {
    expect(serviceItemTypeLabel('Aki')).toBe('Aki')
    useLanguageStore.getState().setLanguage('id')
    expect(serviceItemTypeLabel('Aki')).toBe('Aki')
  })
})

describe('productCategoryLabel', () => {
  it('translates a built-in category into the current language', () => {
    expect(productCategoryLabel('Oli Mesin Diesel')).toBe('Diesel Engine Oil')
    useLanguageStore.getState().setLanguage('id')
    expect(productCategoryLabel('Oli Mesin Diesel')).toBe('Oli Mesin Diesel')
  })

  it("shows a shop's own category exactly as typed", () => {
    useLanguageStore.getState().setLanguage('id')
    expect(productCategoryLabel('Ban')).toBe('Ban')
  })
})

describe('expenseCategoryLabel', () => {
  it('translates a known category into the current language', () => {
    expect(expenseCategoryLabel('Rent')).toBe('Rent')
  })

  it('falls back to categoryOther for an unrecognized category', () => {
    expect(expenseCategoryLabel('Something Made Up')).toBe(expenseCategoryLabel('Other'))
  })
})

describe('appointmentOwnerName', () => {
  const vehicle: Vehicle = {
    id: 'v-1',
    customerId: 'c-1',
    companyId: null,
    make: 'Toyota',
    model: 'Avanza',
    year: 2021,
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
    createdAt: '2026-01-01T00:00:00.000Z',
    isDefault: false,
  }
  const customer: Customer = { id: 'c-1', name: 'Budi', phone: '', email: '', address: '', notes: '', createdAt: '' }
  const vehicleById = new Map([[vehicle.id, vehicle]])

  it('resolves through the vehicle when the appointment has one', () => {
    const label = appointmentOwnerName({ vehicleId: 'v-1', customerId: null, companyId: null }, vehicleById, [customer], [])
    expect(label).toBe('Budi')
  })

  it('resolves a direct customerId with no vehicle yet', () => {
    const label = appointmentOwnerName({ vehicleId: null, customerId: 'c-1', companyId: null }, new Map(), [customer], [])
    expect(label).toBe('Budi')
  })

  it('resolves a direct companyId with no vehicle yet', () => {
    const company: Company = { id: 'co-1', companyName: 'PT Jaya', contactPerson: '', phone: '', email: '', billingAddress: '', notes: '', createdAt: '', drivers: [] }
    const label = appointmentOwnerName({ vehicleId: null, customerId: null, companyId: 'co-1' }, new Map(), [], [company])
    expect(label).toBe('PT Jaya')
  })

  it('falls back to the walk-in label with no owner reference at all', () => {
    const label = appointmentOwnerName({ vehicleId: null, customerId: null, companyId: null }, new Map(), [], [])
    expect(label).toBe('Walk-in')
  })

  it('falls back to the unknown-customer label when the referenced customerId no longer exists', () => {
    const label = appointmentOwnerName({ vehicleId: null, customerId: 'gone', companyId: null }, new Map(), [], [])
    expect(label).toBe('Unknown')
  })
})

describe('vehicleSpecGroups', () => {
  function vehicle(overrides: Partial<Vehicle> = {}): Vehicle {
    return {
      id: 'v-1',
      customerId: null,
      companyId: null,
      make: 'Toyota',
      model: 'Avanza',
      year: 2021,
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
      createdAt: '2026-01-01T00:00:00.000Z',
      isDefault: false,
      ...overrides,
    }
  }

  it('always returns all 4 groups, even with nothing to show', () => {
    const groups = vehicleSpecGroups(vehicle())
    expect(groups.map((g) => g.headingKey)).toEqual([
      'vehicles.basicInfoHeading',
      'vehicles.engineHeading',
      'vehicles.transmissionHeading',
      'vehicles.gardanHeading',
    ])
    expect(groups.every((g) => g.fields.length === 0)).toBe(true)
  })

  it('includes only the fields actually set, per group', () => {
    const groups = vehicleSpecGroups(vehicle({ vin: 'VIN123', engineType: 'Gasoline' }))
    expect(groups[0].fields).toEqual([{ labelKey: 'vehicles.vinLabel', value: 'VIN123', variant: 'mono' }])
    expect(groups[1].fields).toEqual([{ labelKey: 'vehicles.typeLabel', value: 'Gasoline', variant: undefined }])
  })

  it('formats mileage through formatDistance, tagged as the tabular variant', () => {
    const groups = vehicleSpecGroups(vehicle({ currentMileage: 12345 }))
    const mileageField = groups[0].fields.find((f) => f.labelKey === 'vehicles.mileageLabel')
    expect(mileageField?.variant).toBe('tabular')
    expect(mileageField?.value).toContain('12')
  })

  it('tags VIN and plate as the mono variant', () => {
    const groups = vehicleSpecGroups(vehicle({ vin: 'VIN1', licensePlate: 'B 1234 XYZ' }))
    expect(groups[0].fields.every((f) => f.variant === 'mono' || f.labelKey === 'vehicles.mileageLabel')).toBe(true)
  })
})

describe('isBuiltin predicates', () => {
  it('agree with which branch the label functions take', () => {
    expect(isBuiltinServiceItemType('Oli Mesin')).toBe(true)
    expect(isBuiltinServiceItemType('Aki')).toBe(false)
    expect(isBuiltinProductCategory('Oli Mesin Bensin')).toBe(true)
    expect(isBuiltinProductCategory('Ban')).toBe(false)
  })

  it('is not fooled by inherited Object properties', () => {
    // Settings locks the rename field on a `true` here, so a category literally
    // named "constructor" must not come back as built-in.
    expect(isBuiltinServiceItemType('constructor')).toBe(false)
    expect(isBuiltinProductCategory('toString')).toBe(false)
  })
})

describe('itemTypeNameLookup', () => {
  const itemTypes = [
    { id: 'it-1', name: 'Oli Mesin' },
    { id: 'it-2', name: 'Aki' },
  ]

  it('resolves a known id to its translated label', () => {
    const nameOf = itemTypeNameLookup(itemTypes)
    expect(nameOf('it-1')).toBe('Engine Oil')
    expect(nameOf('it-2')).toBe('Aki')
  })

  it('falls back to "unknown" for an id that resolves to nothing', () => {
    const nameOf = itemTypeNameLookup(itemTypes)
    expect(nameOf('missing')).toBe('Unknown')
  })
})

describe('intervalAxisOf', () => {
  it('reports both when km and months are both set', () => {
    expect(intervalAxisOf(5000, 4)).toBe('both')
  })

  it('reports km when only the km axis is set', () => {
    expect(intervalAxisOf(5000, null)).toBe('km')
    expect(intervalAxisOf(5000, undefined)).toBe('km')
  })

  it('reports months when only the months axis is set', () => {
    expect(intervalAxisOf(null, 4)).toBe('months')
  })

  it('reports none when neither is set', () => {
    expect(intervalAxisOf(null, null)).toBe('none')
    expect(intervalAxisOf(undefined, undefined)).toBe('none')
  })

  it('treats 0 the same as unset, matching serviceIntervalLabel\'s own truthiness rule', () => {
    expect(intervalAxisOf(0, 4)).toBe('months')
    expect(intervalAxisOf(5000, 0)).toBe('km')
    expect(intervalAxisOf(0, 0)).toBe('none')
  })
})
