// A headless end-to-end replay of the shop's real flow (CLAUDE.md: customer
// arrives -> vehicle -> work order -> services/products -> complete -> stock
// deducts -> reports), driven through the REAL stores and the REAL ops layer
// (src/lib/ops/deps.ts's realOpsDeps) rather than fakeOpsDeps.ts's in-memory
// stand-ins. Every other ops test in this repo runs on the fakes; this is the
// one place fake-vs-real drift would be caught by the suite itself instead of
// found by hand (see entityHelpers.test.ts / fakeOpsDeps.ts's own header for
// three such drifts patched in an earlier round).
//
// This buys real-store fidelity by giving up per-test isolation: the stores
// are real module singletons, so this file is deliberately one continuous
// story, told as a sequence of `it` blocks that each consume the previous
// one's actual mutations (module-level `let`s carry ids between them) rather
// than independent, individually-seeded units. Read top to bottom.
//
// Must import the localStorage polyfill before any store/ops module — see
// that file's header for why (getDeviceId()/activityLogStore.record() read
// localStorage directly, with no try/catch of their own, unlike every store's
// own persist() call).
import './helpers/nodeLocalStorage'

import { describe, it, expect } from 'vitest'
import { realOpsDeps, type OpsDeps } from '../ops/deps'
import { createEntityOps } from '../ops/entityOps'
import { createInventoryOps } from '../ops/inventoryOps'
import { createOrderOps } from '../ops/orderOps'

import { useCustomerStore } from '../../store/customerStore'
import { useVehicleStore } from '../../store/vehicleStore'
import { useWorkerStore } from '../../store/workerStore'
import { useSupplierStore } from '../../store/supplierStore'
import { useInventoryStore } from '../../store/inventoryStore'
import { useStockLotStore } from '../../store/stockLotStore'
import { useStockMovementStore } from '../../store/stockMovementStore'
import { useExpenseStore } from '../../store/expenseStore'
import { useServiceCatalogStore } from '../../store/serviceCatalogStore'
import { useServiceItemTypeStore } from '../../store/serviceItemTypeStore'
import { useScheduleRuleStore } from '../../store/scheduleRuleStore'
import { useServiceEventStore } from '../../store/serviceEventStore'
import { useWorkOrderStore } from '../../store/workOrderStore'
import { useBayStore } from '../../store/bayStore'
import { useSettingsStore } from '../../store/settingsStore'
import { useActivityLogStore } from '../../store/activityLogStore'
import { useReminderFollowUpStore } from '../../store/reminderFollowUpStore'

import { qtyOnHand, hydrateLots } from '../stockLedger'
import { computePnlSummary, computeCogs, filterCompletedOrders, filterExpensesInRange } from '../finance'
import { getVehicleReminders } from '../reminders'
import { resolveDefaultCatalogMatch } from '../serviceCatalog'

const NOW = new Date('2026-09-03T09:00:00.000Z')
const RANGE = { start: new Date('2026-09-01T00:00:00.000Z'), end: new Date('2026-09-30T23:59:59.000Z') }

function harnessDeps(): OpsDeps {
  // Everything else is realOpsDeps' real singletons; only the three ambients
  // are pinned, same as every fakeOpsDeps test pins seed.now/mode/deviceId.
  return { ...realOpsDeps, now: () => NOW, mode: () => 'admin', deviceId: () => 'harness-device' }
}

const deps = harnessDeps()
const entityOps = createEntityOps(deps)
const inventoryOps = createInventoryOps(deps)
const orderOps = createOrderOps(deps)

// Threaded across stages on purpose — see the file header.
let supplierId: string
let workerId: string
let productId: string
let engineOilTypeId: string
let engineOilServiceId: string
let customerId: string
let vehicleId: string
let orderId: string

describe('shop flow, end to end (real stores, real ops)', () => {
  it('starts from the shop\'s genuinely seeded defaults and nothing else', () => {
    expect(useCustomerStore.getState().customers).toEqual([])
    expect(useVehicleStore.getState().vehicles).toEqual([])
    expect(useWorkOrderStore.getState().workOrders).toEqual([])
    // Deliberately unseeded (serviceCatalogStore.ts's own header comment) —
    // a service is nothing without a price the shop actually agreed to.
    expect(useServiceCatalogStore.getState().services).toEqual([])
    expect(useServiceItemTypeStore.getState().serviceItemTypes).toHaveLength(7)
    expect(useBayStore.getState().bays).toHaveLength(4)
    expect(useBayStore.getState().bays.every((b) => b.status === 'available')).toBe(true)

    engineOilTypeId = useServiceItemTypeStore.getState().serviceItemTypes.find((t) => t.name === 'Oli Mesin')!.id
    expect(engineOilTypeId).toBeTruthy()
  })

  it('shop setup: a supplier and an active technician', () => {
    supplierId = useSupplierStore.getState().addSupplier({
      name: 'PT Sumber Oli', phone: '021-555-0100', email: '', address: '', notes: '',
    }).id
    workerId = useWorkerStore.getState().addWorker({
      name: 'Budi Santoso', phone: '0812-0000-0001', employeeId: 'T-01', hireDate: '2026-01-01', isActive: true, notes: '',
    }).id
    expect(useWorkerStore.getState().getActiveWorkers().map((w) => w.id)).toEqual([workerId])
  })

  it('stock arrives: creating a product opens a FIFO lot and a linked expense in one call', () => {
    const product = inventoryOps.createProduct(
      {
        name: 'Helix HX3 20W-50 1L', sku: 'HX3-1L', supplierCode: '', category: 'Oli Mesin Bensin',
        unit: 'each', costPrice: 60_000, sellPrice: 80_000, reorderPoint: 2, supplierId, notes: '',
      },
      10,
      { amount: 600_000, vendor: 'PT Sumber Oli', description: 'Restock Helix HX3' }
    )
    productId = product.id

    expect(qtyOnHand(useStockMovementStore.getState().movements, productId)).toBe(10)
    expect(useStockLotStore.getState().getLotsByProduct(productId)).toMatchObject([{ unitCost: 60_000, qtyReceived: 10 }])
    expect(useExpenseStore.getState().expenses).toMatchObject([
      { productId, quantityAffected: 10, amount: 600_000, category: 'Inventory Purchase' },
    ])
  })

  it('service catalog: an engine-oil service tagged with both a km and a months interval resolves as the catalog match', () => {
    const service = useServiceCatalogStore.getState().addService({
      name: 'Ganti Oli Mesin', price: 50_000, serviceItemTypeId: engineOilTypeId,
      intervalKm: 5000, intervalMonths: 4, notes: '',
    })
    engineOilServiceId = service.id

    expect(resolveDefaultCatalogMatch(useServiceCatalogStore.getState().services, engineOilTypeId)).toMatchObject({
      id: service.id, intervalKm: 5000, intervalMonths: 4,
    })
  })

  it('a customer arrives', () => {
    customerId = entityOps.createCustomer({ name: 'Andi Wijaya', phone: '0812-3456-7890', email: '', address: '', notes: '' }).id

    expect(useActivityLogStore.getState().entries).toMatchObject([
      { action: 'create', entityType: 'customer', entityId: customerId, label: 'Andi Wijaya' },
    ])
  })

  it('a vehicle is added with the workshop-default schedule, seeding a live rule from the catalog match', () => {
    const { vehicle, seededRules } = entityOps.createVehicleWithSchedule(
      {
        customerId, companyId: null, make: 'Toyota', model: 'Avanza', year: 2020, vin: '',
        licensePlate: 'B 1234 XYZ', color: 'Silver', currentMileage: 45_000,
        engineType: '1.5L 4-cylinder', engineSize: '1.5L', oilTypeRequired: '10W-40', oilCapacity: '3.5L',
        transmissionType: 'Manual', transmissionFluidType: '',
        driveType: 'FWD', differentialFluidType: '',
        notes: '', isDefault: true,
      },
      // engineOilServiceId is the only catalog service with an interval at
      // this point (added two tests up).
      { mode: 'workshop_default', serviceIds: [engineOilServiceId] }
    )
    vehicleId = vehicle.id

    const oilRule = seededRules.find((r) => r.itemTypeId === engineOilTypeId)
    expect(oilRule).toMatchObject({ intervalKm: 5000, baseOdometer: 45_000, intervalMonths: 4, source: 'workshop_default' })
    expect(useScheduleRuleStore.getState().getActiveRule(vehicleId, engineOilTypeId)).toMatchObject({ id: oilRule!.id })
    expect(useVehicleStore.getState().getVehicle(vehicleId)).toMatchObject({ isDefault: true })
  })

  it('a work order is opened, a technician and bay assigned, and a product line + service line added', () => {
    const order = useWorkOrderStore.getState().addWorkOrder({
      vehicleId, workerId, driverId: null, odometerAtArrival: 50_000, odometerAtService: null,
      date: NOW.toISOString(), items: [], subtotal: 0, discountAmount: 0,
      taxPercent: useSettingsStore.getState().settings.taxRate, taxAmount: 0, total: 0,
      paymentMethod: 'pending', status: 'open', notes: '',
    })
    orderId = order.id

    useWorkOrderStore.getState().addItem(orderId, {
      description: 'Helix HX3 20W-50 1L', quantity: 4, unitPrice: 80_000, productId,
    })
    useWorkOrderStore.getState().addItem(orderId, {
      description: 'Ganti Oli Mesin', quantity: 1, unitPrice: 50_000, productId: null, kind: 'service',
      serviceItemTypeId: engineOilTypeId, serviceAction: 'changed', quantityLiters: null, containerType: null,
    })
    orderOps.assignOrderToBay(orderId, '1', workerId, 60)

    const stored = useWorkOrderStore.getState().getWorkOrder(orderId)!
    expect(stored.subtotal).toBe(4 * 80_000 + 50_000)
    expect(useBayStore.getState().bays.find((b) => b.id === '1')).toMatchObject({ status: 'in-service', currentWorkOrderId: orderId })
  })

  it('completing the order deducts stock FIFO, freezes cost of goods, advances the schedule, and releases the bay', () => {
    const result = orderOps.completeOrder(orderId, 'cash')
    expect(result.ok).toBe(true)
    if (!result.ok) return

    // Stock: 10 received - 4 sold = 6, via a single 'sale' movement.
    expect(qtyOnHand(useStockMovementStore.getState().movements, productId)).toBe(6)
    const saleMovements = useStockMovementStore.getState().movements.filter((m) => m.refId === orderId && m.reason === 'sale')
    expect(saleMovements.reduce((sum, m) => sum + m.delta, 0)).toBe(-4)

    // Cost of goods frozen at what those 4 units actually cost (the one lot
    // opened at 60.000/unit), not at sellPrice or any later cost edit.
    const productLine = result.order.items.find((i) => i.productId === productId)!
    expect(productLine.costOfGoods).toBe(4 * 60_000)
    expect(hydrateLots(useStockLotStore.getState().getLotsByProduct(productId), useStockMovementStore.getState().movements)[0].qtyRemaining).toBe(6)

    // Schedule moved to the service odometer, chained back to the seeded rule.
    const newRule = useScheduleRuleStore.getState().getActiveRule(vehicleId, engineOilTypeId)!
    expect(newRule.baseOdometer).toBe(50_000)
    expect(newRule.sourceOrderId).toBe(orderId)
    // supersedeRule stamps real wall-clock time (scheduleRuleStore.ts calls
    // `new Date()` directly, unlike the ops layer's injected `now()`) — assert
    // it's simply no longer live, not an exact timestamp.
    expect(useScheduleRuleStore.getState().getRule(newRule.supersedesId!)?.supersededAt).not.toBeNull()

    // Odometer written back, service event recorded, bay released, no reminder.
    expect(useVehicleStore.getState().getVehicle(vehicleId)).toMatchObject({ currentMileage: 50_000 })
    expect(useServiceEventStore.getState().serviceEvents).toHaveLength(1)
    expect(useBayStore.getState().bays.find((b) => b.id === '1')).toMatchObject({ status: 'available', currentWorkOrderId: null })
    expect(
      getVehicleReminders(
        [useVehicleStore.getState().getVehicle(vehicleId)!],
        useScheduleRuleStore.getState().scheduleRules,
        NOW,
        useReminderFollowUpStore.getState().followUps
      )
    ).toEqual([])
  })

  it('editing the product cost price afterward does not move the frozen cost of goods', () => {
    useInventoryStore.getState().updateProduct(productId, { costPrice: 999_000 })

    const order = useWorkOrderStore.getState().getWorkOrder(orderId)!
    const productLine = order.items.find((i) => i.productId === productId)!
    expect(productLine.costOfGoods).toBe(4 * 60_000) // unchanged by the cost-price edit above
  })

  it('the completed order shows up correctly in the P&L', () => {
    const completed = filterCompletedOrders(useWorkOrderStore.getState().workOrders, RANGE)
    expect(completed).toHaveLength(1)

    const pnl = computePnlSummary(completed, filterExpensesInRange(useExpenseStore.getState().expenses, RANGE))
    // total includes tax (settings.taxRate, 8.25% by default): subtotal
    // 370.000 -> +30.525 tax -> 400.525.
    const subtotal = 4 * 80_000 + 50_000
    const taxRate = useSettingsStore.getState().settings.taxRate
    expect(pnl.revenue).toBe(subtotal + Math.round(subtotal * (taxRate / 100)))

    // Using the CURRENT (edited-to-999.000) cost price to prove computeCogs
    // still prefers the frozen per-line costOfGoods over it.
    const costPriceByProductId = new Map([[productId, useInventoryStore.getState().getProduct(productId)!.costPrice]])
    const cogs = computeCogs(completed, costPriceByProductId)
    expect(cogs.cogs).toBe(4 * 60_000)
    expect(cogs.serviceRevenue).toBe(50_000)
  })

  it('voiding the completed order restores stock in full and unwinds the schedule to its predecessor', () => {
    const activeBefore = useScheduleRuleStore.getState().getActiveRule(vehicleId, engineOilTypeId)!
    const predecessorId = activeBefore.supersedesId!

    const voidResult = orderOps.voidOrder(orderId, 'Customer changed their mind')
    expect(voidResult.ok).toBe(true)

    // Stock: the 4 units sold come back via a fresh 'sale-reversal' movement
    // (never a mutated lot) — 10 received, 0 net consumed.
    expect(qtyOnHand(useStockMovementStore.getState().movements, productId)).toBe(10)

    // Schedule unwound: the rule this order created is superseded, and the
    // rule it replaced is live again.
    expect(useScheduleRuleStore.getState().getActiveRule(vehicleId, engineOilTypeId)).toMatchObject({ id: predecessorId })
    expect(useScheduleRuleStore.getState().getRule(activeBefore.id)?.supersededAt).not.toBeNull()

    // The order drops out of the P&L entirely (status: 'cancelled').
    expect(filterCompletedOrders(useWorkOrderStore.getState().workOrders, RANGE)).toEqual([])
    expect(useWorkOrderStore.getState().getWorkOrder(orderId)).toMatchObject({ status: 'cancelled', voidReason: 'Customer changed their mind' })
  })
})
