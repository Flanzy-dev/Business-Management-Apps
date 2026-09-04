// The half of entityOps deletionPolicy.test.ts can't reach. That file proves
// which blocker string each rule returns; this one proves the *store* half of
// the contract entityOps.ts's header names: that a blocked delete performs no
// mutation, and that an allowed one really removes the row. Those two are the
// whole reason stores arrive through `deps` — without a test they were an
// untested seam.
import { describe, it, expect } from 'vitest'
import { createEntityOps } from '../ops/entityOps'
import { buildFakeOpsDeps } from './helpers/fakeOpsDeps'
import type { Vehicle } from '../../store/vehicleStore'
import type { WorkOrder } from '../../store/workOrderStore'
import type { Product } from '../../store/inventoryStore'

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
    color: '',
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
    ...overrides,
  }
}

function workOrder(overrides: Partial<WorkOrder> = {}): WorkOrder {
  return {
    id: 'wo-1',
    orderNumber: 1,
    vehicleId: 'v-1',
    workerId: null,
    driverId: null,
    status: 'open',
    items: [],
    subtotal: 0,
    discountAmount: 0,
    taxPercent: 0,
    taxAmount: 0,
    total: 0,
    paymentMethod: 'pending',
    odometerAtArrival: null,
    odometerAtService: null,
    notes: '',
    completedAt: null,
    createdAt: '2026-02-01T00:00:00.000Z',
    ...overrides,
  } as WorkOrder
}

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p-1',
    name: 'Helix HX3 20/50 1 L',
    sku: '',
    supplierCode: '',
    category: 'Oli Mesin Bensin',
    unit: 'each',
    costPrice: 60_000,
    sellPrice: 80_000,
    reorderPoint: 0,
    supplierId: null,
    notes: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('a blocked delete performs no mutation', () => {
  it('keeps a customer that still owns a vehicle', () => {
    const world = buildFakeOpsDeps({
      customers: [{ id: 'c-1' }],
      vehicles: [vehicle({ customerId: 'c-1' })],
    })
    const result = createEntityOps(world.deps).deleteCustomerChecked('c-1')

    expect(result.ok).toBe(false)
    expect(world.customers.customers).toHaveLength(1)
  })

  it('keeps a company that still owns a vehicle', () => {
    const world = buildFakeOpsDeps({
      companies: [{ id: 'co-1' }],
      vehicles: [vehicle({ companyId: 'co-1' })],
    })
    const result = createEntityOps(world.deps).deleteCompanyChecked('co-1')

    expect(result.ok).toBe(false)
    expect(world.companies.companies).toHaveLength(1)
  })

  it('keeps a vehicle that still has a work order', () => {
    const world = buildFakeOpsDeps({
      vehicles: [vehicle()],
      workOrders: [workOrder({ vehicleId: 'v-1' })],
    })
    const result = createEntityOps(world.deps).deleteVehicleChecked('v-1')

    expect(result.ok).toBe(false)
    expect(world.vehicles.vehicles).toHaveLength(1)
  })

  it('keeps a product that a work order still references', () => {
    const world = buildFakeOpsDeps({
      products: [product()],
      workOrders: [
        workOrder({
          items: [
            { id: 'i-1', description: 'Oil', quantity: 1, unitPrice: 80_000, lineTotal: 80_000, productId: 'p-1' },
          ],
        }),
      ],
    })
    const result = createEntityOps(world.deps).deleteProductChecked('p-1')

    expect(result.ok).toBe(false)
    expect(world.inventory.products).toHaveLength(1)
  })

  it('keeps a worker that still has a work order', () => {
    const world = buildFakeOpsDeps({
      workers: [{ id: 'w-1' }],
      workOrders: [workOrder({ workerId: 'w-1' })],
    })
    const result = createEntityOps(world.deps).deleteWorkerChecked('w-1')

    expect(result.ok).toBe(false)
    expect(world.workers.workers).toHaveLength(1)
  })

  it('reports the blocker reason rather than failing silently', () => {
    const world = buildFakeOpsDeps({
      customers: [{ id: 'c-1' }],
      vehicles: [vehicle({ customerId: 'c-1' })],
    })
    const result = createEntityOps(world.deps).deleteCustomerChecked('c-1')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason.length).toBeGreaterThan(0)
  })
})

describe('an allowed delete really removes the row', () => {
  it('deletes an unreferenced customer', () => {
    const world = buildFakeOpsDeps({ customers: [{ id: 'c-1' }, { id: 'c-2' }] })
    const result = createEntityOps(world.deps).deleteCustomerChecked('c-1')

    expect(result.ok).toBe(true)
    expect(world.customers.customers.map((c) => (c as { id: string }).id)).toEqual(['c-2'])
  })

  it('deletes a vehicle once its only schedule rule is superseded', () => {
    // A live rule blocks; a superseded one is history and must not.
    const world = buildFakeOpsDeps({
      vehicles: [vehicle()],
      scheduleRules: [
        {
          id: 'sr-1',
          vehicleId: 'v-1',
          itemTypeId: 'sit-1',
          intervalKm: 5000,
          intervalMonths: null,
          lastServiceOdometer: null,
          lastServiceDate: null,
          supersededAt: '2026-03-01T00:00:00.000Z',
          createdAt: '2026-01-01T00:00:00.000Z',
        } as never,
      ],
    })
    const result = createEntityOps(world.deps).deleteVehicleChecked('v-1')

    expect(result.ok).toBe(true)
    expect(world.vehicles.vehicles).toEqual([])
  })

  it('deletes an unreferenced product', () => {
    const world = buildFakeOpsDeps({ products: [product()] })
    const result = createEntityOps(world.deps).deleteProductChecked('p-1')

    expect(result.ok).toBe(true)
    expect(world.inventory.products).toEqual([])
  })
})

describe('the activity log entry a delete writes', () => {
  it('records the customer delete with the name the row had, not its id', () => {
    const world = buildFakeOpsDeps({ customers: [{ id: 'c-1', name: 'Budi' } as never] })
    createEntityOps(world.deps).deleteCustomerChecked('c-1')

    expect(world.activityLog.entries).toHaveLength(1)
    expect(world.activityLog.entries[0]).toMatchObject({
      action: 'delete',
      entityType: 'customer',
      entityId: 'c-1',
      label: 'Budi',
      mode: 'admin',
    })
  })

  it('records the company delete under its company name', () => {
    const world = buildFakeOpsDeps({
      companies: [{ id: 'co-1', companyName: 'PT Maju' } as never],
    })
    createEntityOps(world.deps).deleteCompanyChecked('co-1')

    expect(world.activityLog.entries[0]).toMatchObject({
      entityType: 'company',
      label: 'PT Maju',
    })
  })

  it('records the vehicle delete with its plate, so the log reads like the shop talks', () => {
    const world = buildFakeOpsDeps({ vehicles: [vehicle({ licensePlate: 'B 9 TEST' })] })
    createEntityOps(world.deps).deleteVehicleChecked('v-1')

    expect(world.activityLog.entries[0]).toMatchObject({ entityType: 'vehicle' })
    expect(world.activityLog.entries[0].label).toContain('B 9 TEST')
  })

  it('attributes the entry to whoever was acting', () => {
    const world = buildFakeOpsDeps({
      mode: 'worker',
      customers: [{ id: 'c-1', name: 'Budi' } as never],
    })
    createEntityOps(world.deps).deleteCustomerChecked('c-1')

    expect(world.activityLog.entries[0].mode).toBe('worker')
  })

  it('writes NOTHING when the delete was blocked', () => {
    // The log is a record of what happened; a refused delete didn't happen.
    const world = buildFakeOpsDeps({
      customers: [{ id: 'c-1', name: 'Budi' } as never],
      vehicles: [vehicle({ customerId: 'c-1' })],
    })
    const result = createEntityOps(world.deps).deleteCustomerChecked('c-1')

    expect(result.ok).toBe(false)
    expect(world.activityLog.entries).toEqual([])
  })

  it('falls back to the id when the row is already gone', () => {
    // Deleting a nonexistent id isn't blocked by any policy, so it still logs —
    // better a traceable id than a crash or a blank label.
    const world = buildFakeOpsDeps({ customers: [] })
    createEntityOps(world.deps).deleteCustomerChecked('c-missing')

    expect(world.activityLog.entries[0].label).toBe('c-missing')
  })
})

describe('createCustomer', () => {
  // Closes a gap fakeOpsDeps.ts's customers fake used to have: it was
  // delete-only (createFakeList), so this call would have thrown
  // "addCustomer is not a function" at runtime with no compile-time warning —
  // see the fake's own createFakeCustomers doc comment.
  it('adds the customer to the store and logs the activity entry', () => {
    const world = buildFakeOpsDeps()

    const customer = createEntityOps(world.deps).createCustomer({
      name: 'Budi',
      phone: '0812345678',
      email: '',
      address: '',
      notes: '',
    })

    expect(world.customers.customers).toEqual([customer])
    expect(world.activityLog.entries[0]).toMatchObject({ action: 'create', entityType: 'customer', label: 'Budi' })
  })
})

describe('createVehicleWithSchedule', () => {
  // Omit<Vehicle, 'id' | 'createdAt'> — what the form hands to the op.
  function newVehicleData(overrides: Partial<Vehicle> = {}): Omit<Vehicle, 'id' | 'createdAt'> {
    const { id: _id, createdAt: _createdAt, ...data } = vehicle(overrides)
    return data
  }

  it('seeds every ticked service from the catalog', () => {
    const world = buildFakeOpsDeps({
      serviceItemTypes: [{ id: 'sit-oil', name: 'Oli Mesin', createdAt: '2026-01-01T00:00:00.000Z' } as never],
      services: [
        { id: 'svc-oil', name: 'Ganti Oli Mesin', price: 0, serviceItemTypeId: 'sit-oil', intervalKm: 3000, intervalMonths: null, notes: '', createdAt: '2026-01-01T00:00:00.000Z' },
      ],
    })
    const result = createEntityOps(world.deps).createVehicleWithSchedule(newVehicleData({ currentMileage: 20_000 }), {
      mode: 'workshop_default',
      serviceIds: ['svc-oil'],
    })

    expect(result.oilIntervalApplied).toBe(false)
    expect(world.scheduleRules.scheduleRules).toMatchObject([
      { itemTypeId: 'sit-oil', intervalKm: 3000, baseOdometer: 20_000, source: 'workshop_default' },
    ])
  })

  it('picks one specific service out of an otherwise-ambiguous tag, seeding only that one', () => {
    const world = buildFakeOpsDeps({
      serviceItemTypes: [{ id: 'sit-trans', name: 'Oli Transmisi', createdAt: '2026-01-01T00:00:00.000Z' } as never],
      services: [
        { id: 'svc-manual', name: 'Ganti Oli Transmisi Manual', price: 0, serviceItemTypeId: 'sit-trans', intervalKm: 15_000, intervalMonths: null, notes: '', createdAt: '2026-01-01T00:00:00.000Z' },
        { id: 'svc-matic', name: 'Ganti Oli Transmisi Matic', price: 0, serviceItemTypeId: 'sit-trans', intervalKm: 25_000, intervalMonths: null, notes: '', createdAt: '2026-01-01T00:00:00.000Z' },
      ],
    })
    const result = createEntityOps(world.deps).createVehicleWithSchedule(newVehicleData({ currentMileage: 20_000 }), {
      mode: 'workshop_default',
      serviceIds: ['svc-matic'],
    })

    expect(result.seededRules).toMatchObject([
      { itemTypeId: 'sit-trans', intervalKm: 25_000, source: 'workshop_default' },
    ])
  })

  it('seeds nothing when the checklist left everything unticked — the caller opens Manage Schedule instead', () => {
    const world = buildFakeOpsDeps({
      serviceItemTypes: [{ id: 'sit-oil', name: 'Oli Mesin', createdAt: '2026-01-01T00:00:00.000Z' } as never],
      services: [
        { id: 'svc-oil', name: 'Ganti Oli Mesin', price: 0, serviceItemTypeId: 'sit-oil', intervalKm: 3000, intervalMonths: null, notes: '', createdAt: '2026-01-01T00:00:00.000Z' },
      ],
    })
    const result = createEntityOps(world.deps).createVehicleWithSchedule(newVehicleData(), {
      mode: 'workshop_default',
      serviceIds: [],
    })

    expect(result.seededRules).toEqual([])
    expect(world.scheduleRules.scheduleRules).toEqual([])
  })

  it('seeds nothing when Custom is picked, regardless of any leftover checklist state', () => {
    const world = buildFakeOpsDeps({
      serviceItemTypes: [{ id: 'sit-oil', name: 'Oli Mesin', createdAt: '2026-01-01T00:00:00.000Z' } as never],
      services: [
        { id: 'svc-oil', name: 'Ganti Oli Mesin', price: 0, serviceItemTypeId: 'sit-oil', intervalKm: 3000, intervalMonths: null, notes: '', createdAt: '2026-01-01T00:00:00.000Z' },
      ],
    })
    const result = createEntityOps(world.deps).createVehicleWithSchedule(newVehicleData(), {
      mode: 'custom',
      serviceIds: ['svc-oil'],
    })

    expect(result.seededRules).toEqual([])
    expect(world.scheduleRules.scheduleRules).toEqual([])
  })

  it('customer_interval: overrides only engine oil and leaves every other resolvable item type at its workshop default', () => {
    const world = buildFakeOpsDeps({
      serviceItemTypes: [
        { id: 'sit-oil', name: 'Oli Mesin', createdAt: '2026-01-01T00:00:00.000Z' } as never,
        { id: 'sit-trans', name: 'Oli Transmisi', createdAt: '2026-01-01T00:00:00.000Z' } as never,
      ],
      services: [
        { id: 'svc-oil', name: 'Ganti Oli Mesin', price: 0, serviceItemTypeId: 'sit-oil', intervalKm: 3000, intervalMonths: null, notes: '', createdAt: '2026-01-01T00:00:00.000Z' },
        { id: 'svc-trans', name: 'Ganti Oli Transmisi', price: 0, serviceItemTypeId: 'sit-trans', intervalKm: 10_000, intervalMonths: null, notes: '', createdAt: '2026-01-01T00:00:00.000Z' },
      ],
    })
    const result = createEntityOps(world.deps).createVehicleWithSchedule(newVehicleData({ currentMileage: 20_000 }), {
      mode: 'customer_interval',
      serviceIds: [],
      oilIntervalKm: 5000,
    })

    expect(result.oilIntervalApplied).toBe(true)
    const live = world.scheduleRules.scheduleRules.filter((r) => r.supersededAt === null)
    expect(live).toHaveLength(2)
    expect(live.find((r) => r.itemTypeId === 'sit-oil')).toMatchObject({
      intervalKm: 5000,
      baseOdometer: 20_000,
      source: 'customer_request',
    })
    expect(live.find((r) => r.itemTypeId === 'sit-trans')).toMatchObject({
      intervalKm: 10_000,
      source: 'workshop_default',
    })
  })

  it('leaves every rule at its workshop default when this shop renamed "Oli Mesin" away', () => {
    const world = buildFakeOpsDeps({
      serviceItemTypes: [{ id: 'sit-x', name: 'Oli Spesial', createdAt: '2026-01-01T00:00:00.000Z' } as never],
      services: [
        { id: 'svc-x', name: 'Ganti Oli Spesial', price: 0, serviceItemTypeId: 'sit-x', intervalKm: 4000, intervalMonths: null, notes: '', createdAt: '2026-01-01T00:00:00.000Z' },
      ],
    })
    const result = createEntityOps(world.deps).createVehicleWithSchedule(newVehicleData({ currentMileage: 20_000 }), {
      mode: 'customer_interval',
      serviceIds: [],
      oilIntervalKm: 5000,
    })

    expect(result.oilIntervalApplied).toBe(false)
    expect(world.scheduleRules.scheduleRules).toMatchObject([
      { itemTypeId: 'sit-x', intervalKm: 4000, source: 'workshop_default' },
    ])
  })

  it("claims the owner's default-vehicle slot and clears a sibling's", () => {
    const world = buildFakeOpsDeps({ vehicles: [vehicle({ id: 'v-existing', customerId: 'c-1', isDefault: true })] })
    const result = createEntityOps(world.deps).createVehicleWithSchedule(
      newVehicleData({ customerId: 'c-1', isDefault: true }),
      { mode: 'custom', serviceIds: [] }
    )

    expect(world.vehicles.vehicles.find((v) => v.id === 'v-existing')?.isDefault).toBe(false)
    expect(world.vehicles.vehicles.find((v) => v.id === result.vehicle.id)?.isDefault).toBe(true)
  })

  it('logs the create under the vehicle\'s plate, same as the delete path', () => {
    const world = buildFakeOpsDeps({})
    createEntityOps(world.deps).createVehicleWithSchedule(newVehicleData({ licensePlate: 'B 9 TEST' }), {
      mode: 'custom',
      serviceIds: [],
    })

    expect(world.activityLog.entries[0]).toMatchObject({ action: 'create', entityType: 'vehicle' })
    expect(world.activityLog.entries[0].label).toContain('B 9 TEST')
  })
})

describe('deleteSupplierDetaching', () => {
  it('detaches every product of that supplier instead of orphaning them', () => {
    const world = buildFakeOpsDeps({
      suppliers: [{ id: 's-1' }],
      products: [
        product({ id: 'p-1', supplierId: 's-1' }),
        product({ id: 'p-2', supplierId: 's-1' }),
        product({ id: 'p-3', supplierId: 's-other' }),
      ],
    })
    const { detachedProducts } = createEntityOps(world.deps).deleteSupplierDetaching('s-1')

    expect(detachedProducts).toBe(2)
    // Detached, not deleted — a product outliving its supplier is normal.
    expect(world.inventory.products).toHaveLength(3)
    expect(world.inventory.products.find((p) => p.id === 'p-1')?.supplierId).toBeNull()
    expect(world.inventory.products.find((p) => p.id === 'p-2')?.supplierId).toBeNull()
    // Another supplier's product is untouched.
    expect(world.inventory.products.find((p) => p.id === 'p-3')?.supplierId).toBe('s-other')
    expect(world.suppliers.suppliers).toEqual([])
  })

  it('deletes a supplier with no products and detaches nothing', () => {
    const world = buildFakeOpsDeps({ suppliers: [{ id: 's-1' }] })
    const { detachedProducts } = createEntityOps(world.deps).deleteSupplierDetaching('s-1')

    expect(detachedProducts).toBe(0)
    expect(world.suppliers.suppliers).toEqual([])
  })
})
