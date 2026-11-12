import { describe, it, expect, beforeEach } from 'vitest'
import { useLanguageStore } from '../../store/languageStore'
import {
  isBuiltinProductCategory,
  isBuiltinServiceItemType,
  isBuiltinServiceCatalogItem,
  productCategoryLabel,
  serviceItemTypeLabel,
  serviceCatalogLabel,
  expenseCategoryLabel,
  appointmentOwnerName,
  vehicleSpecGroups,
  itemTypeNameLookup,
  intervalAxisOf,
  vehicleLabel,
  ownerContact,
  workerName,
  PRODUCT_UNITS,
  unitLabel,
  orderStatusLabel,
  serviceIntervalLabel,
  vinDecodeSummary,
} from '../format/entities'
import type { Vehicle } from '../../store/vehicleStore'
import type { Customer } from '../../store/customerStore'
import type { Company } from '../../store/companyStore'
import type { Worker } from '../../store/workerStore'

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

  it('translates each of the v3->v4 categories into the current language', () => {
    expect(productCategoryLabel('Filter Oli')).toBe('Oil Filter')
    expect(productCategoryLabel('Aki & Kelistrikan')).toBe('Battery & Electrical')
    useLanguageStore.getState().setLanguage('id')
    expect(productCategoryLabel('Filter Oli')).toBe('Filter Oli')
    expect(productCategoryLabel('Aki & Kelistrikan')).toBe('Aki & Kelistrikan')
  })

  it('translates the v4->v5 combined category (replaced Oli Hidrolik + Oli Industri)', () => {
    expect(productCategoryLabel('Oli Industri / Hidrolik')).toBe('Industrial / Hydraulic Oil')
    useLanguageStore.getState().setLanguage('id')
    expect(productCategoryLabel('Oli Industri / Hidrolik')).toBe('Oli Industri / Hidrolik')
  })

  it('no longer recognizes the two categories it replaced as built-in', () => {
    expect(productCategoryLabel('Oli Hidrolik')).toBe('Oli Hidrolik')
    expect(productCategoryLabel('Oli Industri')).toBe('Oli Industri')
  })
})

describe('isBuiltinProductCategory', () => {
  it('true for every seeded category, including the v3->v4 additions', () => {
    expect(isBuiltinProductCategory('Oli Mesin Diesel')).toBe(true)
    expect(isBuiltinProductCategory('Filter Oli')).toBe(true)
    expect(isBuiltinProductCategory('Perlengkapan Bengkel')).toBe(true)
  })

  it('true for the v4->v5 combined category, false for the two it replaced', () => {
    expect(isBuiltinProductCategory('Oli Industri / Hidrolik')).toBe(true)
    expect(isBuiltinProductCategory('Oli Hidrolik')).toBe(false)
    expect(isBuiltinProductCategory('Oli Industri')).toBe(false)
  })

  it("false for a shop's own category", () => {
    expect(isBuiltinProductCategory('Ban')).toBe(false)
  })
})

describe('serviceCatalogLabel', () => {
  it('translates a built-in seeded service into the current language', () => {
    expect(serviceCatalogLabel('Ganti Oli Mesin')).toBe('Engine Oil Change')
    useLanguageStore.getState().setLanguage('id')
    expect(serviceCatalogLabel('Ganti Oli Mesin')).toBe('Ganti Oli Mesin')
  })

  it("shows a shop's own service exactly as typed, in every language", () => {
    expect(serviceCatalogLabel('Spooring')).toBe('Spooring')
    useLanguageStore.getState().setLanguage('id')
    expect(serviceCatalogLabel('Spooring')).toBe('Spooring')
  })
})

describe('isBuiltinServiceCatalogItem', () => {
  it('true for each of the seven seeded services', () => {
    expect(isBuiltinServiceCatalogItem('Ganti Oli Mesin')).toBe(true)
    expect(isBuiltinServiceCatalogItem('Ganti Minyak Power Steering')).toBe(true)
  })

  it("false for a shop's own service", () => {
    expect(isBuiltinServiceCatalogItem('Spooring')).toBe(false)
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

describe('vehicleLabel', () => {
  it('joins year, make and model', () => {
    expect(vehicleLabel({ year: 2021, make: 'Toyota', model: 'Avanza' } as any)).toBe('2021 Toyota Avanza')
  })

  it('omits a missing year rather than leaving a blank slot', () => {
    expect(vehicleLabel({ year: 0, make: 'Toyota', model: 'Avanza' } as any)).toBe('Toyota Avanza')
  })

  it('falls back to a placeholder for no vehicle at all', () => {
    expect(vehicleLabel(null)).toBe('Unknown vehicle')
    expect(vehicleLabel(undefined)).toBe('Unknown vehicle')
  })
})

describe('ownerContact', () => {
  const customer: Customer = { id: 'c-1', name: 'Budi', phone: '0812', email: 'budi@x.com', address: '', notes: '', createdAt: '' }
  const company: Company = { id: 'co-1', companyName: 'PT Jaya', contactPerson: '', phone: '021', email: 'jaya@x.com', billingAddress: '', notes: '', createdAt: '', drivers: [] }
  function vehicleWith(overrides: Partial<Vehicle>): Vehicle {
    return {
      id: 'v-1', customerId: null, companyId: null, make: 'Toyota', model: 'Avanza', year: 2021,
      vin: '', licensePlate: '', color: '', currentMileage: null, engineType: '', engineSize: '',
      oilTypeRequired: '', oilCapacity: '', transmissionType: '', transmissionFluidType: '',
      driveType: '', differentialFluidType: '', notes: '', createdAt: '2026-01-01T00:00:00.000Z',
      isDefault: false, ...overrides,
    }
  }

  it('resolves through the linked customer', () => {
    const v = vehicleWith({ customerId: 'c-1' })
    expect(ownerContact(v, [customer], [])).toEqual({ phone: '0812', email: 'budi@x.com' })
  })

  it('resolves through the linked company', () => {
    const v = vehicleWith({ companyId: 'co-1' })
    expect(ownerContact(v, [], [company])).toEqual({ phone: '021', email: 'jaya@x.com' })
  })

  it('returns null when the referenced customer no longer exists', () => {
    const v = vehicleWith({ customerId: 'gone' })
    expect(ownerContact(v, [], [])).toBeNull()
  })

  it('returns null with no vehicle at all', () => {
    expect(ownerContact(null, [customer], [company])).toBeNull()
  })

  it('returns null for a vehicle with neither a customer nor a company', () => {
    expect(ownerContact(vehicleWith({}), [customer], [company])).toBeNull()
  })
})

describe('workerName', () => {
  const workers: Worker[] = [{ id: 'w-1', name: 'Andi', phone: '', employeeId: '', hireDate: '', isActive: true, notes: '', createdAt: '' }]

  it('resolves a known worker id to its name', () => {
    expect(workerName('w-1', workers)).toBe('Andi')
  })

  it('shows a dash for no worker assigned', () => {
    expect(workerName(null, workers)).toBe('-')
  })

  it('shows Unknown for an id that no longer resolves', () => {
    expect(workerName('gone', workers)).toBe('Unknown')
  })
})

describe('unitLabel / orderStatusLabel', () => {
  it('translates every declared product unit into the current language', () => {
    for (const unit of PRODUCT_UNITS) {
      expect(typeof unitLabel(unit)).toBe('string')
      expect(unitLabel(unit).length).toBeGreaterThan(0)
    }
  })

  it('falls back to the each-unit label for an unrecognized unit', () => {
    expect(unitLabel('bogus-unit')).toBe(unitLabel('each'))
  })

  it('translates every known order status, and falls back to open for an unrecognized one', () => {
    expect(orderStatusLabel('completed')).not.toBe(orderStatusLabel('open'))
    expect(orderStatusLabel('cancelled')).not.toBe(orderStatusLabel('open'))
    expect(orderStatusLabel('bogus-status')).toBe(orderStatusLabel('open'))
  })
})

describe('serviceIntervalLabel', () => {
  it('combines both axes when both are set', () => {
    expect(serviceIntervalLabel(5000, 4)).toBe('Every 5.000 km or 4 months')
  })

  it('shows only km when only km is set', () => {
    expect(serviceIntervalLabel(5000, null)).toBe('Every 5.000 km')
  })

  it('shows only months when only months is set', () => {
    expect(serviceIntervalLabel(null, 4)).toBe('Every 4 months')
  })

  it('returns null when neither is set, matching intervalAxisOf\'s none case', () => {
    expect(serviceIntervalLabel(null, null)).toBeNull()
    expect(serviceIntervalLabel(0, 0)).toBeNull()
  })
})

describe('vinDecodeSummary', () => {
  it('combines manufacturer, country and model year when all three decode', () => {
    const summary = vinDecodeSummary({ manufacturer: 'Toyota', country: 'Japan', modelYear: 2021 })
    expect(summary).toContain('Toyota')
    expect(summary).toContain('Japan')
    expect(summary).toContain('2021')
  })

  it('shows manufacturer alone when country is unknown', () => {
    const summary = vinDecodeSummary({ manufacturer: 'Toyota', country: null, modelYear: null })
    expect(summary).toContain('Toyota')
    expect(summary).not.toContain('(')
  })

  it('returns null when nothing at all decoded', () => {
    expect(vinDecodeSummary({ manufacturer: null, country: null, modelYear: null })).toBeNull()
  })
})