// completeOrder / deleteOrder end to end. orderLifecycle.test.ts already proves
// the pure deduct-once/restore-once decision; this file proves the orchestration
// around it — that the FIFO draw, the frozen costOfGoods, the ledger movements
// and the schedule move all actually land, and that deleting a completed order
// puts back exactly what it took.
import { describe, it, expect } from 'vitest'
import { createOrderOps } from '../ops/orderOps'
import { buildFakeOpsDeps } from './helpers/fakeOpsDeps'
import { qtyOnHand } from '../stockLedger'
import type { Product } from '../../store/inventoryStore'
import type { StockLot } from '../../store/stockLotStore'
import type { StockMovement } from '../../store/stockMovementStore'
import type { WorkOrder, WorkOrderItem } from '../../store/workOrderStore'
import type { Vehicle } from '../../store/vehicleStore'
import type { ScheduleRule } from '../../store/scheduleRuleStore'
import type { Bay } from '../../store/bayStore'

const NOW = new Date('2026-08-10T09:00:00.000Z')

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

function lot(overrides: Partial<StockLot> = {}): StockLot {
  return {
    id: 'lot-1',
    productId: 'p-1',
    unitCost: 50_000,
    qtyReceived: 4,
    receivedAt: '2026-01-01T00:00:00.000Z',
    expenseId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as StockLot
}

function movement(overrides: Partial<StockMovement> = {}): StockMovement {
  return {
    id: 'm-1',
    productId: 'p-1',
    delta: 4,
    reason: 'purchase',
    lotId: 'lot-1',
    unitCost: 50_000,
    refType: null,
    refId: null,
    occurredAt: '2026-01-01T00:00:00.000Z',
    deviceId: 'seed',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as StockMovement
}

function item(overrides: Partial<WorkOrderItem> = {}): WorkOrderItem {
  return {
    id: 'i-1',
    description: 'Helix HX3 20/50 1 L',
    quantity: 2,
    unitPrice: 80_000,
    lineTotal: 160_000,
    productId: 'p-1',
    ...overrides,
  }
}

function order(overrides: Partial<WorkOrder> = {}): WorkOrder {
  return {
    id: 'wo-1',
    orderNumber: 1,
    vehicleId: 'v-1',
    workerId: null,
    driverId: null,
    odometerAtArrival: 50_000,
    odometerAtService: null,
    date: '2026-08-10',
    items: [item()],
    subtotal: 160_000,
    discountAmount: 0,
    taxPercent: 0,
    taxAmount: 0,
    total: 160_000,
    paymentMethod: 'pending',
    status: 'open',
    notes: '',
    createdAt: '2026-08-10T08:00:00.000Z',
    completedAt: null,
    ...overrides,
  }
}

function vehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 'v-1',
    customerId: 'c-1',
    companyId: null,
    make: 'Toyota',
    model: 'Avanza',
    year: 2021,
    vin: '',
    licensePlate: 'B 1234 XYZ',
    color: '',
    currentMileage: 40_000,
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

function scheduleRule(overrides: Partial<ScheduleRule> = {}): ScheduleRule {
  return {
    id: 'sr-1',
    vehicleId: 'v-1',
    itemTypeId: 'sit-oil',
    intervalKm: 5000,
    baseOdometer: 40_000,
    intervalMonths: null,
    baseDate: null,
    source: 'workshop_default',
    supersededAt: null,
    supersedesId: null,
    notes: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function bay(overrides: Partial<Bay> = {}): Bay {
  return {
    id: 'bay-1',
    name: 'Bay 1',
    status: 'available',
    currentWorkOrderId: null,
    assignedWorkerId: null,
    estimatedEndTime: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('completeOrder', () => {
  it('freezes what the stock actually cost onto the line and draws it from the ledger', () => {
    const world = buildFakeOpsDeps({
      products: [product()],
      stockLots: [lot()],
      movements: [movement()],
      workOrders: [order()],
      now: NOW,
    })
    const result = createOrderOps(world.deps).completeOrder('wo-1', 'cash')

    expect(result.ok).toBe(true)
    // 2 units out of the 50.000 lot.
    expect(world.workOrders.workOrders[0].items[0].costOfGoods).toBe(100_000)
    expect(world.workOrders.workOrders[0].status).toBe('completed')
    expect(qtyOnHand(world.movements.movements, 'p-1')).toBe(2)
    expect(world.movements.movements.filter((m) => m.reason === 'sale')).toHaveLength(1)
  })

  it('refuses before touching anything when stock is short', () => {
    const world = buildFakeOpsDeps({
      products: [product()],
      stockLots: [lot({ qtyReceived: 1 })],
      movements: [movement({ delta: 1 })],
      workOrders: [order()],
      now: NOW,
    })
    const result = createOrderOps(world.deps).completeOrder('wo-1', 'cash')

    expect(result.ok).toBe(false)
    // Nothing moved: status and ledger are exactly as seeded.
    expect(world.workOrders.workOrders[0].status).toBe('open')
    expect(world.movements.movements).toHaveLength(1)
  })

  it('prices stock no lot can cover at the product cost, still accounting for the full quantity', () => {
    const world = buildFakeOpsDeps({
      products: [product({ costPrice: 70_000 })],
      // Ledger says 3 on hand, but only 1 is backed by a lot.
      stockLots: [lot({ qtyReceived: 1 })],
      movements: [movement({ delta: 1 }), movement({ id: 'm-legacy', delta: 2, lotId: null })],
      workOrders: [order({ items: [item({ quantity: 3 })] })],
      now: NOW,
    })
    createOrderOps(world.deps).completeOrder('wo-1', 'cash')

    // 1 x 50.000 from the lot + 2 x 70.000 fallback.
    expect(world.workOrders.workOrders[0].items[0].costOfGoods).toBe(190_000)
    expect(qtyOnHand(world.movements.movements, 'p-1')).toBe(0)
  })

  it('does not let two lines of one product draw the same lot twice', () => {
    const world = buildFakeOpsDeps({
      products: [product()],
      stockLots: [lot({ qtyReceived: 4 })],
      movements: [movement({ delta: 4 })],
      workOrders: [order({ items: [item({ id: 'a', quantity: 2 }), item({ id: 'b', quantity: 2 })] })],
      now: NOW,
    })
    createOrderOps(world.deps).completeOrder('wo-1', 'cash')

    const [a, b] = world.workOrders.workOrders[0].items
    expect(a.costOfGoods).toBe(100_000)
    expect(b.costOfGoods).toBe(100_000)
    expect(qtyOnHand(world.movements.movements, 'p-1')).toBe(0)
  })

  it('reports an order that is not there rather than throwing', () => {
    const world = buildFakeOpsDeps({ now: NOW })
    const result = createOrderOps(world.deps).completeOrder('missing', 'cash')
    expect(result.ok).toBe(false)
  })

  it('writes the odometer back to the vehicle even when no line was tagged', () => {
    // order()'s default item is a plain product line — no serviceItemTypeId,
    // so this never produces a ServiceEvent. The mileage still has to move:
    // this is exactly the bug where a wiper-blade-only visit left the vehicle
    // believing a stale reading.
    const world = buildFakeOpsDeps({
      products: [product()],
      stockLots: [lot()],
      movements: [movement()],
      vehicles: [vehicle({ currentMileage: 40_000 })],
      workOrders: [order({ odometerAtService: 62_000 })],
      now: NOW,
    })
    createOrderOps(world.deps).completeOrder('wo-1', 'cash')

    expect(world.vehicles.vehicles[0].currentMileage).toBe(62_000)
  })

  it('leaves the vehicle mileage alone when the new reading is not higher', () => {
    const world = buildFakeOpsDeps({
      products: [product()],
      stockLots: [lot()],
      movements: [movement()],
      vehicles: [vehicle({ currentMileage: 70_000 })],
      workOrders: [order({ odometerAtService: 62_000 })],
      now: NOW,
    })
    createOrderOps(world.deps).completeOrder('wo-1', 'cash')

    expect(world.vehicles.vehicles[0].currentMileage).toBe(70_000)
  })

  it('creates a schedule rule from a customer-requested interval when the vehicle had none', () => {
    const world = buildFakeOpsDeps({
      products: [],
      vehicles: [vehicle()],
      workOrders: [
        order({
          items: [
            item({
              productId: null,
              serviceItemTypeId: 'sit-oil',
              serviceAction: 'changed',
              requestedIntervalKm: 5000,
            }),
          ],
          odometerAtService: 62_000,
        }),
      ],
      now: NOW,
    })
    createOrderOps(world.deps).completeOrder('wo-1', 'cash')

    const rules = world.scheduleRules.scheduleRules.filter((r) => r.supersededAt === null)
    expect(rules).toHaveLength(1)
    expect(rules[0]).toMatchObject({
      itemTypeId: 'sit-oil',
      intervalKm: 5000,
      baseOdometer: 62_000,
      source: 'customer_request',
      supersedesId: null,
    })
  })

  it('supersedes the shop default with the customer-requested interval, chaining supersedesId', () => {
    const world = buildFakeOpsDeps({
      products: [],
      vehicles: [vehicle()],
      scheduleRules: [scheduleRule({ intervalKm: 5000, baseOdometer: 40_000, source: 'workshop_default' })],
      workOrders: [
        order({
          items: [
            item({
              productId: null,
              serviceItemTypeId: 'sit-oil',
              serviceAction: 'changed',
              requestedIntervalKm: 3000,
            }),
          ],
          odometerAtService: 62_000,
        }),
      ],
      now: NOW,
    })
    createOrderOps(world.deps).completeOrder('wo-1', 'cash')

    const live = world.scheduleRules.scheduleRules.find((r) => r.supersededAt === null)
    expect(live).toMatchObject({
      intervalKm: 3000,
      baseOdometer: 62_000,
      source: 'customer_request',
      supersedesId: 'sr-1',
    })
    expect(world.scheduleRules.scheduleRules.find((r) => r.id === 'sr-1')?.supersededAt).not.toBeNull()
  })

  it('never moves the schedule for a topped-up line, even with a requested interval attached', () => {
    const world = buildFakeOpsDeps({
      products: [],
      vehicles: [vehicle()],
      scheduleRules: [scheduleRule({ intervalKm: 5000, baseOdometer: 40_000, source: 'workshop_default' })],
      workOrders: [
        order({
          items: [
            item({
              productId: null,
              serviceItemTypeId: 'sit-oil',
              serviceAction: 'topped_up',
              requestedIntervalKm: 3000,
            }),
          ],
          odometerAtService: 62_000,
        }),
      ],
      now: NOW,
    })
    createOrderOps(world.deps).completeOrder('wo-1', 'cash')

    expect(world.scheduleRules.scheduleRules).toEqual([scheduleRule({ intervalKm: 5000, baseOdometer: 40_000, source: 'workshop_default' })])
  })

  it('creates a schedule rule from the catalog interval for a "changed" line with no rule and no requested interval', () => {
    // The gap this closes: previously a "changed" service with no rule and no
    // customer-requested interval was a silent no-op — the vehicle stayed
    // unscheduled forever. Now it gets a rule sized from the catalog.
    const world = buildFakeOpsDeps({
      products: [],
      vehicles: [vehicle()],
      services: [{ id: 's-1', serviceItemTypeId: 'sit-oil', intervalKm: 8000, intervalMonths: null, isDefaultForItemType: false }],
      workOrders: [
        order({
          items: [item({ productId: null, serviceItemTypeId: 'sit-oil', serviceAction: 'changed' })],
          odometerAtService: 62_000,
        }),
      ],
      now: NOW,
    })
    createOrderOps(world.deps).completeOrder('wo-1', 'cash')

    const active = world.scheduleRules.getActiveRule('v-1', 'sit-oil')
    expect(active).toMatchObject({ intervalKm: 8000, baseOdometer: 62_000, source: 'workshop_default', sourceOrderId: 'wo-1' })
  })

  it('tags a line that carries both a productId and a schedule tag the same as a plain service line', () => {
    // What handleAddProduct (WorkOrderEditor.tsx) now produces for a product
    // resolving to a schedule item — the line is a real inventory sale AND
    // feeds ServiceEvent/ScheduleRule, same as a linked catalog service.
    const world = buildFakeOpsDeps({
      products: [product()],
      stockLots: [lot()],
      movements: [movement()],
      vehicles: [vehicle()],
      workOrders: [
        order({
          items: [item({ productId: 'p-1', serviceItemTypeId: 'sit-oil', serviceAction: 'changed', quantity: 1, lineTotal: 80_000 })],
          odometerAtService: 62_000,
        }),
      ],
      now: NOW,
    })
    createOrderOps(world.deps).completeOrder('wo-1', 'cash')

    expect(world.serviceEvents.serviceEvents).toHaveLength(1)
    expect(world.scheduleRules.getActiveRule('v-1', 'sit-oil')).toMatchObject({ baseOdometer: 62_000 })
    // Still a real inventory sale — stock moved same as any product line.
    expect(qtyOnHand(world.movements.movements, 'p-1')).toBe(3)
  })

  it('advances the schedule from the vehicle\'s own mileage when the order recorded no odometer at all', () => {
    const world = buildFakeOpsDeps({
      products: [],
      vehicles: [vehicle({ currentMileage: 62_000 })],
      scheduleRules: [scheduleRule({ intervalKm: 5000, baseOdometer: 40_000, source: 'workshop_default' })],
      workOrders: [
        order({
          items: [item({ productId: null, serviceItemTypeId: 'sit-oil', serviceAction: 'changed' })],
          odometerAtArrival: null,
          odometerAtService: null,
        }),
      ],
      now: NOW,
    })
    createOrderOps(world.deps).completeOrder('wo-1', 'cash')

    expect(world.scheduleRules.getActiveRule('v-1', 'sit-oil')).toMatchObject({ baseOdometer: 62_000 })
  })

  it("clears the vehicle's reminder follow-up record once a real service completes", () => {
    const world = buildFakeOpsDeps({
      products: [],
      vehicles: [vehicle()],
      reminderFollowUps: [{ id: 'v-1', vehicleId: 'v-1', contactedAt: '2026-08-01T00:00:00.000Z', snoozeUntil: '2026-09-01' }],
      workOrders: [
        order({
          items: [item({ productId: null, serviceItemTypeId: 'sit-oil', serviceAction: 'changed' })],
          odometerAtService: 62_000,
        }),
      ],
      now: NOW,
    })
    createOrderOps(world.deps).completeOrder('wo-1', 'cash')

    expect(world.reminderFollowUps.getForVehicle('v-1')).toMatchObject({ contactedAt: null, snoozeUntil: null })
  })

  it('creates a fresh (all-null) follow-up record for a vehicle that never had one, rather than leaving it absent', () => {
    // No reminderFollowUps seed at all — pins the fake's clear() to the real
    // store's upsert behavior (src/store/reminderFollowUpStore.ts), which
    // creates a null row rather than no-op'ing when nothing exists yet.
    const world = buildFakeOpsDeps({
      products: [],
      vehicles: [vehicle()],
      workOrders: [
        order({
          items: [item({ productId: null, serviceItemTypeId: 'sit-oil', serviceAction: 'changed' })],
          odometerAtService: 62_000,
        }),
      ],
      now: NOW,
    })
    createOrderOps(world.deps).completeOrder('wo-1', 'cash')

    expect(world.reminderFollowUps.getForVehicle('v-1')).toMatchObject({ contactedAt: null, snoozeUntil: null })
  })

  it('leaves no follow-up record behind when the order carries no tagged service at all', () => {
    const world = buildFakeOpsDeps({
      products: [product()],
      stockLots: [lot()],
      movements: [movement()],
      workOrders: [order()],
      now: NOW,
    })
    createOrderOps(world.deps).completeOrder('wo-1', 'cash')

    expect(world.reminderFollowUps.getForVehicle('v-1')).toBeUndefined()
  })
})

describe('deleteOrder', () => {
  it('puts a completed order\'s stock back exactly once, at what it cost', () => {
    const world = buildFakeOpsDeps({
      products: [product()],
      stockLots: [lot()],
      movements: [movement()],
      workOrders: [order()],
      now: NOW,
    })
    const ops = createOrderOps(world.deps)
    ops.completeOrder('wo-1', 'cash')
    expect(qtyOnHand(world.movements.movements, 'p-1')).toBe(2)

    ops.deleteOrder('wo-1')

    // Back to the 4 it started with — not 6, not 2.
    expect(qtyOnHand(world.movements.movements, 'p-1')).toBe(4)
    const reversal = world.movements.movements.find((m) => m.reason === 'sale-reversal')
    expect(reversal).toMatchObject({ delta: 2, unitCost: 50_000 })
    expect(world.workOrders.workOrders).toEqual([])
  })

  it('returns no stock for an order that was never completed', () => {
    const world = buildFakeOpsDeps({
      products: [product()],
      stockLots: [lot()],
      movements: [movement()],
      workOrders: [order()],
      now: NOW,
    })
    createOrderOps(world.deps).deleteOrder('wo-1')

    expect(qtyOnHand(world.movements.movements, 'p-1')).toBe(4)
    expect(world.movements.movements).toHaveLength(1)
    expect(world.workOrders.workOrders).toEqual([])
  })

  it('is a no-op for an order that is not there', () => {
    const world = buildFakeOpsDeps({ now: NOW })
    expect(() => createOrderOps(world.deps).deleteOrder('missing')).not.toThrow()
  })

  it("unwinds the schedule move a 'changed' line caused, restoring the vehicle's prior next-due", () => {
    const world = buildFakeOpsDeps({
      products: [],
      vehicles: [vehicle()],
      scheduleRules: [scheduleRule({ intervalKm: 5000, baseOdometer: 40_000, source: 'workshop_default' })],
      workOrders: [
        order({
          items: [item({ productId: null, serviceItemTypeId: 'sit-oil', serviceAction: 'changed' })],
          odometerAtService: 62_000,
        }),
      ],
      now: NOW,
    })
    const ops = createOrderOps(world.deps)
    ops.completeOrder('wo-1', 'cash')
    expect(world.scheduleRules.getActiveRule('v-1', 'sit-oil')?.baseOdometer).toBe(62_000)

    ops.deleteOrder('wo-1')

    expect(world.scheduleRules.getActiveRule('v-1', 'sit-oil')).toMatchObject({ id: 'sr-1', baseOdometer: 40_000 })
  })
})

describe('voidOrder', () => {
  it('keeps the row as cancelled with the reason, restores stock once, and drops the service events', () => {
    const world = buildFakeOpsDeps({
      products: [product()],
      stockLots: [lot()],
      movements: [movement()],
      workOrders: [order({ items: [item({ serviceItemTypeId: 'sit-oil', serviceAction: 'changed', quantityLiters: 1 })] })],
      scheduleRules: [scheduleRule()],
      serviceItemTypes: [{ id: 'sit-oil' }],
      now: NOW,
    })
    const ops = createOrderOps(world.deps)
    ops.completeOrder('wo-1', 'cash')
    expect(world.serviceEvents.serviceEvents).toHaveLength(1)
    expect(qtyOnHand(world.movements.movements, 'p-1')).toBe(2)

    const res = ops.voidOrder('wo-1', 'customer disputed the charge')

    expect(res.ok).toBe(true)
    const wo = world.workOrders.workOrders[0]
    expect(wo.status).toBe('cancelled')
    expect(wo.voidReason).toBe('customer disputed the charge')
    expect(wo.voidedAt).toBe(NOW.toISOString())
    expect(qtyOnHand(world.movements.movements, 'p-1')).toBe(4)
    expect(world.movements.movements.filter((m) => m.reason === 'sale-reversal')).toHaveLength(1)
    expect(world.serviceEvents.serviceEvents).toHaveLength(0)
  })

  it('refuses to void an order that was never completed', () => {
    const world = buildFakeOpsDeps({ workOrders: [order()], now: NOW })
    const res = createOrderOps(world.deps).voidOrder('wo-1', 'nope')
    expect(res.ok).toBe(false)
    expect(world.workOrders.workOrders[0].status).toBe('open')
  })

  it('stores amountReceived on the completed order', () => {
    const world = buildFakeOpsDeps({
      products: [product()],
      stockLots: [lot()],
      movements: [movement()],
      workOrders: [order()],
      now: NOW,
    })
    createOrderOps(world.deps).completeOrder('wo-1', 'cash', 200_000)
    expect(world.workOrders.workOrders[0].amountReceived).toBe(200_000)
  })

  it('stores the due date only when completed as pending', () => {
    const world = buildFakeOpsDeps({
      products: [product()],
      stockLots: [lot()],
      movements: [movement()],
      workOrders: [order()],
      now: NOW,
    })
    createOrderOps(world.deps).completeOrder('wo-1', 'pending', null, '2026-09-01')
    expect(world.workOrders.workOrders[0].paymentDueDate).toBe('2026-09-01')
  })

  it("unwinds the schedule move a voided order's 'changed' line caused", () => {
    const world = buildFakeOpsDeps({
      products: [],
      vehicles: [vehicle()],
      scheduleRules: [scheduleRule({ intervalKm: 5000, baseOdometer: 40_000, source: 'workshop_default' })],
      workOrders: [
        order({
          items: [item({ productId: null, serviceItemTypeId: 'sit-oil', serviceAction: 'changed' })],
          odometerAtService: 62_000,
        }),
      ],
      now: NOW,
    })
    const ops = createOrderOps(world.deps)
    ops.completeOrder('wo-1', 'cash')

    ops.voidOrder('wo-1', 'mis-keyed')

    expect(world.scheduleRules.getActiveRule('v-1', 'sit-oil')).toMatchObject({ id: 'sr-1', baseOdometer: 40_000 })
  })

  it("leaves a later order's schedule move alone when an earlier order is voided", () => {
    const world = buildFakeOpsDeps({
      products: [],
      vehicles: [vehicle()],
      scheduleRules: [scheduleRule({ intervalKm: 5000, baseOdometer: 40_000, source: 'workshop_default' })],
      workOrders: [
        order({
          id: 'wo-1',
          items: [item({ productId: null, serviceItemTypeId: 'sit-oil', serviceAction: 'changed' })],
          odometerAtService: 62_000,
        }),
        order({
          id: 'wo-2',
          orderNumber: 2,
          items: [item({ id: 'i-2', productId: null, serviceItemTypeId: 'sit-oil', serviceAction: 'changed' })],
          odometerAtService: 67_000,
        }),
      ],
      now: NOW,
    })
    const ops = createOrderOps(world.deps)
    ops.completeOrder('wo-1', 'cash')
    ops.completeOrder('wo-2', 'cash')
    expect(world.scheduleRules.getActiveRule('v-1', 'sit-oil')?.baseOdometer).toBe(67_000)

    ops.voidOrder('wo-1', 'mis-keyed')

    expect(world.scheduleRules.getActiveRule('v-1', 'sit-oil')?.baseOdometer).toBe(67_000)
  })
})

describe('recordPayment', () => {
  it('collects a pending completed order\'s debt', () => {
    const world = buildFakeOpsDeps({
      workOrders: [order({ status: 'completed', paymentMethod: 'pending', paymentDueDate: '2026-08-20' })],
      now: NOW,
    })
    const result = createOrderOps(world.deps).recordPayment('wo-1', 'cash', 160_000)

    expect(result.ok).toBe(true)
    const updated = world.workOrders.workOrders[0]
    expect(updated.paymentMethod).toBe('cash')
    expect(updated.amountReceived).toBe(160_000)
    expect(updated.paidAt).toBe(NOW.toISOString())
  })

  it('refuses an order that is not awaiting payment (no double-collection)', () => {
    const world = buildFakeOpsDeps({
      workOrders: [order({ status: 'completed', paymentMethod: 'cash' })],
      now: NOW,
    })
    const result = createOrderOps(world.deps).recordPayment('wo-1', 'qris', null)

    expect(result.ok).toBe(false)
    expect(world.workOrders.workOrders[0].paymentMethod).toBe('cash')
  })

  it('refuses an order that was never found', () => {
    const world = buildFakeOpsDeps({ now: NOW })
    const result = createOrderOps(world.deps).recordPayment('missing', 'cash', null)
    expect(result.ok).toBe(false)
  })
})

describe('assignOrderToBay', () => {
  it('claims the bay for this order and stamps an estimated end time from the injected clock', () => {
    const world = buildFakeOpsDeps({ bays: [bay({ id: 'bay-1' })], now: NOW })
    createOrderOps(world.deps).assignOrderToBay('wo-1', 'bay-1', 'w-1', 60)

    const assigned = world.bays.bays[0]
    expect(assigned.status).toBe('in-service')
    expect(assigned.currentWorkOrderId).toBe('wo-1')
    expect(assigned.assignedWorkerId).toBe('w-1')
    expect(assigned.estimatedEndTime).toBe('2026-08-10T10:00:00.000Z')
  })

  it('releases the order\'s previous bay when reassigned to a different one — never occupies two bays at once', () => {
    const world = buildFakeOpsDeps({
      bays: [bay({ id: 'bay-1', status: 'in-service', currentWorkOrderId: 'wo-1' }), bay({ id: 'bay-2' })],
      now: NOW,
    })
    createOrderOps(world.deps).assignOrderToBay('wo-1', 'bay-2', null, 30)

    const [bay1, bay2] = world.bays.bays
    expect(bay1.status).toBe('available')
    expect(bay1.currentWorkOrderId).toBeNull()
    expect(bay2.currentWorkOrderId).toBe('wo-1')
  })
})

describe('bay occupancy derived from the order lifecycle', () => {
  it('completeOrder releases whatever bay held the order', () => {
    const world = buildFakeOpsDeps({
      products: [product()],
      stockLots: [lot()],
      movements: [movement()],
      workOrders: [order()],
      bays: [bay({ id: 'bay-1', status: 'in-service', currentWorkOrderId: 'wo-1', assignedWorkerId: 'w-1' })],
      now: NOW,
    })
    createOrderOps(world.deps).completeOrder('wo-1', 'cash')

    const released = world.bays.bays[0]
    expect(released.status).toBe('available')
    expect(released.currentWorkOrderId).toBeNull()
  })

  it('completeOrder is a no-op on bays when the order never held one', () => {
    const world = buildFakeOpsDeps({
      products: [product()],
      stockLots: [lot()],
      movements: [movement()],
      workOrders: [order()],
      bays: [bay({ id: 'bay-1' })],
      now: NOW,
    })
    expect(() => createOrderOps(world.deps).completeOrder('wo-1', 'cash')).not.toThrow()
    expect(world.bays.bays[0].status).toBe('available')
  })

  it('deleteOrder releases whatever bay held the order', () => {
    const world = buildFakeOpsDeps({
      workOrders: [order()],
      bays: [bay({ id: 'bay-1', status: 'in-service', currentWorkOrderId: 'wo-1' })],
      now: NOW,
    })
    createOrderOps(world.deps).deleteOrder('wo-1')
    expect(world.bays.bays[0].currentWorkOrderId).toBeNull()
  })

  it('voidOrder releases whatever bay held the order', () => {
    const world = buildFakeOpsDeps({
      products: [product()],
      stockLots: [lot()],
      movements: [movement()],
      workOrders: [order({ status: 'completed', completedAt: '2026-08-10T09:00:00.000Z' })],
      bays: [bay({ id: 'bay-1', status: 'in-service', currentWorkOrderId: 'wo-1' })],
      now: NOW,
    })
    const result = createOrderOps(world.deps).voidOrder('wo-1', 'customer changed mind')
    expect(result.ok).toBe(true)
    expect(world.bays.bays[0].currentWorkOrderId).toBeNull()
  })
})
