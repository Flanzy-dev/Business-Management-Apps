// The add/edit-vehicle form's rules, now that they live outside the component
// (see src/lib/vehicleForm.ts's header for why that matters). The cases worth
// having are the ones a shop would notice: an edit must not demote an owner's
// default vehicle, an owner's first vehicle must become their default, and a
// half-filled form must not save.
import { describe, it, expect } from 'vitest'
import {
  initialVehicleDraft,
  draftOwnerId,
  ownerHasVehicle,
  scheduleChoiceFromForm,
  scheduleSeedOutcome,
  scheduleSetupCandidates,
  initialScheduleSelection,
  toggleScheduleSelection,
  validateVehicleDraft,
  vehicleDraftToData,
  type VehicleDraft,
} from '../vehicleForm'
import type { ServiceCatalogItem } from '../../store/serviceCatalogStore'
import type { Vehicle } from '../../store/vehicleStore'

function vehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 'v-1',
    customerId: null,
    companyId: null,
    make: 'Toyota',
    model: 'Avanza',
    year: 2021,
    vin: '',
    licensePlate: 'B 1234 XYZ',
    color: 'Silver',
    currentMileage: 10_000,
    engineType: 'Gasoline',
    engineSize: '1.5L',
    oilTypeRequired: '10W-40',
    oilCapacity: '3.5 L',
    transmissionType: 'Manual',
    transmissionFluidType: '',
    driveType: 'FWD',
    differentialFluidType: '',
    notes: 'note',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

/** A draft that passes validation, so a test can vary one thing at a time. */
function validDraft(overrides: Partial<VehicleDraft> = {}): VehicleDraft {
  return { ...initialVehicleDraft(null), make: 'Toyota', model: 'Avanza', ...overrides }
}

describe('initialVehicleDraft', () => {
  it('starts empty with customer as the default owner type when creating', () => {
    const draft = initialVehicleDraft(null)

    expect(draft.ownerType).toBe('customer')
    expect(draft.make).toBe('')
    expect(draft.year).toBe('')
    expect(draft.currentMileage).toBe('')
  })

  it('honours the caller’s pre-selected owner (arriving from a customer’s page)', () => {
    const draft = initialVehicleDraft(null, { ownerType: 'company', companyId: 'co-1' })

    expect(draft.ownerType).toBe('company')
    expect(draft.companyId).toBe('co-1')
  })

  it('fills every field from the vehicle being edited', () => {
    const draft = initialVehicleDraft(vehicle({ customerId: 'c-1' }))

    expect(draft).toMatchObject({
      ownerType: 'customer',
      customerId: 'c-1',
      make: 'Toyota',
      model: 'Avanza',
      licensePlate: 'B 1234 XYZ',
      engineType: 'Gasoline',
      driveType: 'FWD',
      notes: 'note',
    })
  })

  it('turns numbers into the strings an <input> holds', () => {
    const draft = initialVehicleDraft(vehicle({ year: 2021, currentMileage: 10_000 }))

    expect(draft.year).toBe('2021')
    expect(draft.currentMileage).toBe('10000')
  })

  it('leaves a null year or mileage blank rather than showing "null"', () => {
    const draft = initialVehicleDraft(vehicle({ year: null, currentMileage: null }))

    expect(draft.year).toBe('')
    expect(draft.currentMileage).toBe('')
  })

  it('infers company ownership from the vehicle itself, overriding any hint', () => {
    const draft = initialVehicleDraft(vehicle({ companyId: 'co-9' }), {
      ownerType: 'customer',
      customerId: 'c-1',
    })

    expect(draft.ownerType).toBe('company')
    expect(draft.companyId).toBe('co-9')
  })
})

describe('draftOwnerId / ownerHasVehicle', () => {
  it('reads the id belonging to the selected owner type', () => {
    const draft = validDraft({ ownerType: 'customer', customerId: 'c-1', companyId: 'co-1' })
    expect(draftOwnerId(draft)).toBe('c-1')
    expect(draftOwnerId({ ...draft, ownerType: 'company' })).toBe('co-1')
  })

  it('is false when no owner has been picked yet', () => {
    // No owner means no "first vehicle for this owner" to be.
    expect(ownerHasVehicle([vehicle({ customerId: 'c-1' })], validDraft())).toBe(false)
  })

  it('finds an existing vehicle for the selected customer', () => {
    const draft = validDraft({ customerId: 'c-1' })
    expect(ownerHasVehicle([vehicle({ customerId: 'c-1' })], draft)).toBe(true)
    expect(ownerHasVehicle([vehicle({ customerId: 'c-other' })], draft)).toBe(false)
  })

  it('does not confuse a company id with a customer id', () => {
    // Same id string on the other ownership field must not count.
    const draft = validDraft({ ownerType: 'company', companyId: 'x-1' })
    expect(ownerHasVehicle([vehicle({ customerId: 'x-1' })], draft)).toBe(false)
    expect(ownerHasVehicle([vehicle({ companyId: 'x-1' })], draft)).toBe(true)
  })
})

describe('validateVehicleDraft', () => {
  it('accepts a draft with make and model and no VIN or plate', () => {
    // Both are optional fields — an old car with no readable VIN is normal.
    expect(validateVehicleDraft(validDraft())).toEqual({ ok: true })
  })

  it('rejects a blank make or model', () => {
    const noMake = validateVehicleDraft(validDraft({ make: '' }))
    const noModel = validateVehicleDraft(validDraft({ model: '  ' }))

    expect(noMake.ok).toBe(false)
    if (!noMake.ok) expect(noMake.missingRequired).toBe(true)
    expect(noModel.ok).toBe(false)
    if (!noModel.ok) expect(noModel.missingRequired).toBe(true)
  })

  it('rejects a VIN that is not 17 characters', () => {
    const result = validateVehicleDraft(validDraft({ vin: 'ABC123' }))

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.vinError).toBeTruthy()
  })

  it('accepts a well-formed 17-character VIN', () => {
    expect(validateVehicleDraft(validDraft({ vin: '1HGBH41JXMN109186' }))).toEqual({ ok: true })
  })

  it('rejects an over-long plate', () => {
    const result = validateVehicleDraft(validDraft({ licensePlate: 'B 1234 XYZ EXTRA' }))

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.plateError).toBeTruthy()
  })

  it('reports a bad VIN and a bad plate together, not one at a time', () => {
    // Fixing one field per submit is the annoying version of this form.
    const result = validateVehicleDraft(validDraft({ vin: 'SHORT', licensePlate: 'X' }))

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.vinError).toBeTruthy()
      expect(result.plateError).toBeTruthy()
    }
  })
})

describe('vehicleDraftToData', () => {
  it('files the vehicle under the selected owner and nulls the other side', () => {
    const data = vehicleDraftToData(
      validDraft({ ownerType: 'customer', customerId: 'c-1', companyId: 'co-stale' }),
      { isNew: true, ownerHasVehicles: false }
    )

    expect(data.customerId).toBe('c-1')
    // A company id left over from toggling the radio must not be stored.
    expect(data.companyId).toBeNull()
  })

  it('stores an unpicked owner as null rather than an empty string', () => {
    const data = vehicleDraftToData(validDraft(), { isNew: true, ownerHasVehicles: false })

    expect(data.customerId).toBeNull()
    expect(data.companyId).toBeNull()
  })

  it('parses year and mileage back into numbers, and blank into null', () => {
    const filled = vehicleDraftToData(validDraft({ year: '2021', currentMileage: '10000' }), {
      isNew: true,
      ownerHasVehicles: false,
    })
    const blank = vehicleDraftToData(validDraft({ year: '', currentMileage: '' }), {
      isNew: true,
      ownerHasVehicles: false,
    })

    expect(filled.year).toBe(2021)
    expect(filled.currentMileage).toBe(10_000)
    expect(blank.year).toBeNull()
    expect(blank.currentMileage).toBeNull()
  })

  it('makes an owner’s first vehicle their default', () => {
    const data = vehicleDraftToData(validDraft({ customerId: 'c-1' }), {
      isNew: true,
      ownerHasVehicles: false,
    })

    expect(data.isDefault).toBe(true)
  })

  it('does not make a second vehicle the default', () => {
    const data = vehicleDraftToData(validDraft({ customerId: 'c-1' }), {
      isNew: true,
      ownerHasVehicles: true,
    })

    expect(data.isDefault).toBe(false)
  })

  it('omits isDefault entirely on an edit, so a correction cannot demote the default', () => {
    // The invariant worth a test: updateVehicle merges partially, so sending
    // `isDefault: false` here would silently clear the owner's default vehicle
    // every time someone fixed a typo on it.
    const data = vehicleDraftToData(validDraft({ customerId: 'c-1' }), {
      isNew: false,
      ownerHasVehicles: true,
    })

    expect('isDefault' in data).toBe(false)
  })

  it('carries every spec field through unchanged', () => {
    const draft = validDraft({
      engineType: 'Diesel',
      engineSize: '2.5L',
      oilTypeRequired: '15W-40',
      oilCapacity: '6 L',
      transmissionType: 'Automatic',
      transmissionFluidType: 'ATF Type T-IV',
      driveType: '4WD',
      differentialFluidType: '75W-90',
      notes: 'fleet unit',
      color: 'White',
    })
    const data = vehicleDraftToData(draft, { isNew: true, ownerHasVehicles: false })

    expect(data).toMatchObject({
      engineType: 'Diesel',
      engineSize: '2.5L',
      oilTypeRequired: '15W-40',
      oilCapacity: '6 L',
      transmissionType: 'Automatic',
      transmissionFluidType: 'ATF Type T-IV',
      driveType: '4WD',
      differentialFluidType: '75W-90',
      notes: 'fleet unit',
      color: 'White',
    })
  })
})

let nextSvcId = 1
function catalogService(overrides: Partial<ServiceCatalogItem> = {}): ServiceCatalogItem {
  return {
    id: `svc-${nextSvcId++}`,
    name: 'Ganti Oli',
    price: 50000,
    serviceItemTypeId: null,
    notes: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('scheduleSetupCandidates', () => {
  it('offers one candidate for an item type with exactly one interval-carrying service', () => {
    const itemTypes = [{ id: 'it-oil', name: 'Oli Mesin' }, { id: 'it-wash', name: 'Cuci' }]
    const service = catalogService({ serviceItemTypeId: 'it-oil', intervalKm: 5000, intervalMonths: 4, name: 'Ganti Oli Mesin' })

    expect(scheduleSetupCandidates(itemTypes, [service])).toEqual([
      { serviceId: service.id, itemTypeId: 'it-oil', itemTypeName: 'Oli Mesin', serviceName: 'Ganti Oli Mesin', intervalKm: 5000, intervalMonths: 4 },
    ])
  })

  it('lists every candidate service under a tag with several — never picking one for the shop', () => {
    const itemTypes = [{ id: 'it-trans', name: 'Oli Transmisi' }]
    const manual = catalogService({ serviceItemTypeId: 'it-trans', intervalKm: 15000, name: 'Ganti Oli Transmisi Manual' })
    const matic = catalogService({ serviceItemTypeId: 'it-trans', intervalKm: 25000, name: 'Ganti Oli Transmisi Matic' })

    expect(scheduleSetupCandidates(itemTypes, [manual, matic])).toEqual([
      { serviceId: manual.id, itemTypeId: 'it-trans', itemTypeName: 'Oli Transmisi', serviceName: 'Ganti Oli Transmisi Manual', intervalKm: 15000, intervalMonths: null },
      { serviceId: matic.id, itemTypeId: 'it-trans', itemTypeName: 'Oli Transmisi', serviceName: 'Ganti Oli Transmisi Matic', intervalKm: 25000, intervalMonths: null },
    ])
  })

  it('skips a service with no schedule tag or no interval at all', () => {
    const itemTypes = [{ id: 'it-oil', name: 'Oli Mesin' }]
    const untagged = catalogService({ serviceItemTypeId: null, intervalKm: 5000 })
    const noInterval = catalogService({ serviceItemTypeId: 'it-oil', intervalKm: null, intervalMonths: null })

    expect(scheduleSetupCandidates(itemTypes, [untagged, noInterval])).toEqual([])
  })
})

describe('initialScheduleSelection', () => {
  it('ticks a candidate that is the only one for its item type', () => {
    const candidates = [
      { serviceId: 'svc-oil', itemTypeId: 'it-oil', itemTypeName: 'Oli Mesin', serviceName: 'Ganti Oli Mesin', intervalKm: 5000, intervalMonths: null },
      { serviceId: 'svc-filter', itemTypeId: 'it-filter', itemTypeName: 'Filter Oli', serviceName: 'Ganti Filter Oli', intervalKm: 15000, intervalMonths: null },
    ]
    expect(initialScheduleSelection(candidates)).toEqual({ 'svc-oil': true, 'svc-filter': true })
  })

  it('leaves every candidate of an ambiguous tag unticked — never guessing which one applies', () => {
    const candidates = [
      { serviceId: 'svc-manual', itemTypeId: 'it-trans', itemTypeName: 'Oli Transmisi', serviceName: 'Manual', intervalKm: 15000, intervalMonths: null },
      { serviceId: 'svc-matic', itemTypeId: 'it-trans', itemTypeName: 'Oli Transmisi', serviceName: 'Matic', intervalKm: 25000, intervalMonths: null },
    ]
    expect(initialScheduleSelection(candidates)).toEqual({ 'svc-manual': false, 'svc-matic': false })
  })

  it('is empty for no candidates', () => {
    expect(initialScheduleSelection([])).toEqual({})
  })
})

describe('toggleScheduleSelection', () => {
  const candidates = [
    { serviceId: 'svc-manual', itemTypeId: 'it-trans', itemTypeName: 'Oli Transmisi', serviceName: 'Manual', intervalKm: 15000, intervalMonths: null },
    { serviceId: 'svc-matic', itemTypeId: 'it-trans', itemTypeName: 'Oli Transmisi', serviceName: 'Matic', intervalKm: 25000, intervalMonths: null },
    { serviceId: 'svc-oil', itemTypeId: 'it-oil', itemTypeName: 'Oli Mesin', serviceName: 'Ganti Oli Mesin', intervalKm: 5000, intervalMonths: null },
  ]

  it('ticking one candidate clears any other ticked candidate sharing its item type', () => {
    const selected = { 'svc-manual': true, 'svc-matic': false, 'svc-oil': true }
    expect(toggleScheduleSelection(candidates, selected, 'svc-matic')).toEqual({
      'svc-manual': false,
      'svc-matic': true,
      'svc-oil': true,
    })
  })

  it('ticking off just clears itself', () => {
    const selected = { 'svc-manual': true, 'svc-matic': false, 'svc-oil': true }
    expect(toggleScheduleSelection(candidates, selected, 'svc-manual')).toEqual({
      'svc-manual': false,
      'svc-matic': false,
      'svc-oil': true,
    })
  })

  it('an unrecognized service id is a no-op', () => {
    const selected = { 'svc-manual': true, 'svc-matic': false, 'svc-oil': true }
    expect(toggleScheduleSelection(candidates, selected, 'svc-ghost')).toBe(selected)
  })
})

describe('scheduleChoiceFromForm', () => {
  it('workshop_default: returns every ticked service id, dropping the unticked ones', () => {
    expect(scheduleChoiceFromForm('workshop_default', { 'svc-1': true, 'svc-2': false, 'svc-3': true }, '')).toEqual({
      mode: 'workshop_default',
      serviceIds: ['svc-1', 'svc-3'],
    })
  })

  it('workshop_default: returns an empty list when nothing is ticked — the "seed nothing" case', () => {
    expect(scheduleChoiceFromForm('workshop_default', {}, '')).toEqual({ mode: 'workshop_default', serviceIds: [] })
    expect(scheduleChoiceFromForm('workshop_default', { 'svc-1': false }, '')).toEqual({
      mode: 'workshop_default',
      serviceIds: [],
    })
  })

  it('custom: always seeds nothing, ignoring the checklist and any typed km', () => {
    expect(scheduleChoiceFromForm('custom', { 'svc-1': true }, '3000')).toEqual({
      mode: 'custom',
      serviceIds: [],
    })
  })

  it('customer_interval: pairs the mode with the parsed km, ignoring the checklist', () => {
    expect(scheduleChoiceFromForm('customer_interval', { 'svc-1': true }, '3000')).toEqual({
      mode: 'customer_interval',
      serviceIds: [],
      oilIntervalKm: 3000,
    })
  })

  it('customer_interval: rejects a blank, zero, negative, or non-numeric km', () => {
    expect(scheduleChoiceFromForm('customer_interval', {}, '')).toBeNull()
    expect(scheduleChoiceFromForm('customer_interval', {}, '0')).toBeNull()
    expect(scheduleChoiceFromForm('customer_interval', {}, '-500')).toBeNull()
    expect(scheduleChoiceFromForm('customer_interval', {}, 'abc')).toBeNull()
  })
})

describe('scheduleSeedOutcome', () => {
  it('flags the request as unapplied when the ops layer could not find engine oil', () => {
    const outcome = scheduleSeedOutcome(
      { mode: 'customer_interval', serviceIds: [], oilIntervalKm: 3000 },
      { seededRules: [{}], oilIntervalApplied: false }
    )
    expect(outcome).toEqual({ kind: 'customerIntervalNotApplied' })
  })

  it('reports how many rules were seeded once the request (if any) was honoured', () => {
    const outcome = scheduleSeedOutcome(
      { mode: 'customer_interval', serviceIds: [], oilIntervalKm: 3000 },
      { seededRules: [{}, {}], oilIntervalApplied: true }
    )
    expect(outcome).toEqual({ kind: 'seeded', count: 2 })
  })

  it('says nothing seeded when the checklist was left empty', () => {
    const outcome = scheduleSeedOutcome(
      { mode: 'workshop_default', serviceIds: [] },
      { seededRules: [], oilIntervalApplied: false }
    )
    expect(outcome).toEqual({ kind: 'none' })
  })
})

describe('the edit round trip', () => {
  it('an untouched edit reproduces the vehicle it started from', () => {
    // The property that catches a field dropped from either mapping: load a
    // vehicle into the form, save without typing, and nothing should move.
    const original = vehicle({ customerId: 'c-1', vin: '1HGBH41JXMN109186' })
    const data = vehicleDraftToData(initialVehicleDraft(original), {
      isNew: false,
      ownerHasVehicles: true,
    })

    const { id: _id, createdAt: _createdAt, isDefault: _isDefault, ...expected } = original
    expect(data).toEqual(expected)
  })
})
