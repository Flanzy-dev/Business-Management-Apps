import { describe, it, expect } from 'vitest'
import type { Vehicle } from '../../store/vehicleStore'
import type { WorkOrder, WorkOrderItem } from '../../store/workOrderStore'
import type { Product } from '../../store/inventoryStore'
import type { ScheduleRule } from '../../store/scheduleRuleStore'
import type { Expense } from '../../store/expenseStore'
import {
  customerDeletionBlocker,
  companyDeletionBlocker,
  vehicleDeletionBlocker,
  productDeletionBlocker,
  productCategoryDeletionBlocker,
  workerDeletionBlocker,
  serviceItemTypeDeletionBlocker,
  productsToDetachFromSupplier,
} from '../deletionPolicy'

let nextId = 1

function vehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: `v-${nextId++}`,
    customerId: null,
    companyId: null,
    make: 'Toyota',
    model: 'Avanza',
    year: 2021,
    vin: '',
    licensePlate: 'B 1234 XYZ',
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
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

function item(overrides: Partial<WorkOrderItem> = {}): WorkOrderItem {
  return {
    id: `item-${nextId++}`,
    description: 'Line item',
    quantity: 1,
    unitPrice: 0,
    lineTotal: 0,
    productId: null,
    ...overrides,
  }
}

function order(overrides: Partial<WorkOrder> = {}): WorkOrder {
  return {
    id: `wo-${nextId++}`,
    orderNumber: 1001,
    vehicleId: 'v-1',
    workerId: null,
    driverId: null,
    odometerAtArrival: null,
    odometerAtService: null,
    date: '2026-06-15',
    items: [],
    subtotal: 0,
    discountAmount: 0,
    taxPercent: 0,
    taxAmount: 0,
    total: 0,
    paymentMethod: 'cash',
    status: 'completed',
    notes: '',
    createdAt: new Date().toISOString(),
    completedAt: null,
    ...overrides,
  }
}

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: `p-${nextId++}`,
    name: 'Oil 5W30',
    sku: '',
    supplierCode: '',
    category: 'Oil',
    unit: 'liter',
    costPrice: 0,
    sellPrice: 0,
    reorderPoint: 0,
    supplierId: null,
    notes: '',
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

function expense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: `e-${nextId++}`,
    date: '2026-06-15',
    category: 'Inventory Purchase',
    description: 'Expense',
    amount: 0,
    vendor: '',
    notes: '',
    createdAt: new Date().toISOString(),
    productId: null,
    quantityAffected: null,
    ...overrides,
  }
}

describe('owner deletion blockers', () => {
  it('blocks deleting a customer who still owns vehicles', () => {
    const vehicles = [vehicle({ customerId: 'c-1' }), vehicle({ customerId: 'c-1' })]
    expect(customerDeletionBlocker('c-1', vehicles)).toMatch(/2 vehicles/)
    expect(customerDeletionBlocker('c-2', vehicles)).toBeNull()
  })

  it('blocks deleting a company that still owns vehicles', () => {
    const vehicles = [vehicle({ companyId: 'co-1' })]
    expect(companyDeletionBlocker('co-1', vehicles)).toMatch(/1 vehicle\./)
    expect(companyDeletionBlocker('co-2', vehicles)).toBeNull()
  })
})

function rule(overrides: Partial<ScheduleRule> = {}): ScheduleRule {
  return {
    id: `rule-${nextId++}`,
    vehicleId: 'v-1',
    itemTypeId: 'oli-mesin',
    intervalKm: 5000,
    baseOdometer: 0,
    source: 'workshop_default',
    supersededAt: null,
    supersedesId: null,
    notes: '',
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('history-preserving blockers', () => {
  it('blocks deleting a vehicle with service orders', () => {
    const orders = [order({ vehicleId: 'v-9' })]
    expect(vehicleDeletionBlocker('v-9', orders)).toMatch(/1 service order/)
    expect(vehicleDeletionBlocker('v-8', orders)).toBeNull()
  })

  it('blocks deleting a vehicle with a live schedule rule but no orders', () => {
    const rules = [rule({ vehicleId: 'v-7' })]
    expect(vehicleDeletionBlocker('v-7', [], rules)).toMatch(/1 service schedule rule/)
    expect(vehicleDeletionBlocker('v-6', [], rules)).toBeNull()
  })

  it('does not count a superseded schedule rule against deletion', () => {
    const rules = [rule({ vehicleId: 'v-7', supersededAt: new Date().toISOString() })]
    expect(vehicleDeletionBlocker('v-7', [], rules)).toBeNull()
  })

  it('blocks deleting a service item type referenced by a schedule rule or tagged line', () => {
    const rules = [rule({ itemTypeId: 'oli-mesin' })]
    const orders = [order({ items: [item({ serviceItemTypeId: 'filter-oli' })] })]
    expect(serviceItemTypeDeletionBlocker('oli-mesin', rules, [])).toMatch(/schedule rule/)
    expect(serviceItemTypeDeletionBlocker('filter-oli', [], orders)).toMatch(/service order line/)
    expect(serviceItemTypeDeletionBlocker('oli-gardan', rules, orders)).toBeNull()
  })

  it('blocks deleting a product referenced by order items (COGS history)', () => {
    const orders = [order({ items: [item({ productId: 'p-9' })] })]
    expect(productDeletionBlocker('p-9', orders)).toMatch(/cost history/)
    expect(productDeletionBlocker('p-8', orders)).toBeNull()
  })

  it('blocks deleting a product linked from an Inventory Purchase expense', () => {
    const expenses = [expense({ productId: 'p-9' })]
    expect(productDeletionBlocker('p-9', [], expenses)).toMatch(/1 expense/)
    expect(productDeletionBlocker('p-8', [], expenses)).toBeNull()
  })

  it('combines order and expense references into one blocker message', () => {
    const orders = [order({ items: [item({ productId: 'p-9' })] })]
    const expenses = [expense({ productId: 'p-9' })]
    const reason = productDeletionBlocker('p-9', orders, expenses)
    expect(reason).toMatch(/service order/)
    expect(reason).toMatch(/expense/)
  })

  it('blocks deleting a worker assigned to orders, suggesting deactivation', () => {
    const orders = [order({ workerId: 'w-9' })]
    expect(workerDeletionBlocker('w-9', orders)).toMatch(/inactive/)
    expect(workerDeletionBlocker('w-8', orders)).toBeNull()
  })

  it('blocks deleting a product category still assigned to a product', () => {
    const products = [product({ category: 'Oil' }), product({ category: 'Oil' }), product({ category: 'Filter' })]
    expect(productCategoryDeletionBlocker('Oil', products)).toMatch(/2 products/)
    expect(productCategoryDeletionBlocker('Filter', products)).toMatch(/1 product\./)
    expect(productCategoryDeletionBlocker('Fluid', products)).toBeNull()
  })
})

describe('productsToDetachFromSupplier', () => {
  it('lists only the products linked to the supplier', () => {
    const linked = product({ supplierId: 's-1' })
    const products = [linked, product({ supplierId: 's-2' }), product()]
    expect(productsToDetachFromSupplier('s-1', products)).toEqual([linked])
  })
})
