// In-memory stand-ins for the stores the ops layer drives, for the ops tests.
//
// Not a .test.ts file, so vitest's include glob (src/**/*.test.ts) treats it as
// a plain module rather than an empty suite.
//
// Each fake reimplements only the actions ops actually call, using the same
// entityHelpers the real stores use so ids, createdAt stamps and by-id updates
// behave identically. That leaves one honest gap: a fake satisfies less than
// the full store interface, so `buildFakeOpsDeps` casts once at the boundary
// and every fake is exposed as its own typed handle for assertions. The cast is
// deliberate and contained — widening it would mean rebuilding sixteen stores.
import { newEntity, removeById, updateById } from '../../../store/entityHelpers'
import type { OpsDeps, StoreHandle } from '../../ops/deps'
import type { Product } from '../../../store/inventoryStore'
import type { Expense } from '../../../store/expenseStore'
import type { StockLot } from '../../../store/stockLotStore'
import type { StockMovement } from '../../../store/stockMovementStore'
import type { WorkOrder } from '../../../store/workOrderStore'
import type { Vehicle } from '../../../store/vehicleStore'
import { newestRule, type ScheduleRule } from '../../../store/scheduleRuleStore'
import type { ActivityLogEntry } from '../../../store/activityLogStore'
import type { Bay } from '../../../store/bayStore'
import type { Customer } from '../../../store/customerStore'
import type { Mode } from '../../auth/permissions'

/** Wraps a mutable state object as something with getState(). */
function handle<T>(state: T): StoreHandle<T> {
  return { getState: () => state }
}

function createFakeInventory(products: Product[] = []) {
  const state = {
    products,
    getProduct: (id: string) => state.products.find((p) => p.id === id),
    addProduct: (data: Omit<Product, 'id' | 'createdAt'>) => {
      const product = newEntity(data)
      state.products = [...state.products, product]
      return product
    },
    addProducts: (list: Omit<Product, 'id' | 'createdAt'>[]) => {
      const created = list.map((d) => newEntity(d))
      state.products = [...state.products, ...created]
      return created
    },
    updateProduct: (id: string, data: Partial<Product>) => {
      state.products = updateById(state.products, id, data)
    },
    deleteProduct: (id: string) => {
      state.products = removeById(state.products, id)
    },
  }
  return state
}

function createFakeExpenses(expenses: Expense[] = []) {
  const state = {
    expenses,
    getExpense: (id: string) => state.expenses.find((e) => e.id === id),
    addExpense: (data: Omit<Expense, 'id' | 'createdAt'>) => {
      const expense = newEntity(data)
      state.expenses = [...state.expenses, expense]
      return expense
    },
    deleteExpense: (id: string) => {
      state.expenses = removeById(state.expenses, id)
    },
  }
  return state
}

function createFakeStockLots(stockLots: StockLot[] = [], backfilledAt: string | null = null) {
  const state = {
    stockLots,
    backfilledAt,
    addLot: (data: Omit<StockLot, 'id' | 'createdAt'>) => {
      const lot = newEntity(data)
      state.stockLots = [...state.stockLots, lot]
      return lot
    },
    getLotsByProduct: (productId: string) =>
      state.stockLots
        .filter((l) => l.productId === productId)
        .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt)),
    markBackfilled: (at: string) => {
      state.backfilledAt = at
    },
  }
  return state
}

function createFakeMovements(movements: StockMovement[] = [], ledgerBackfilledAt: string | null = null) {
  const state = {
    movements,
    ledgerBackfilledAt,
    // deviceId/mode now arrive as ordinary fields on `data` — the ops layer
    // supplies them from deps.deviceId()/deps.mode(), same as every other
    // ambient value — so the fake no longer stamps them itself. See
    // src/store/stockMovementStore.ts's doc comment.
    addMovement: (data: Omit<StockMovement, 'id' | 'createdAt'>) => {
      const movement = newEntity(data)
      state.movements = [...state.movements, movement]
      return movement
    },
    markLedgerBackfilled: (at: string) => {
      state.ledgerBackfilledAt = at
    },
  }
  return state
}

function createFakeWorkOrders(workOrders: WorkOrder[] = []) {
  const state = {
    workOrders,
    getWorkOrder: (id: string) => state.workOrders.find((w) => w.id === id),
    updateWorkOrder: (id: string, data: Partial<WorkOrder>) => {
      state.workOrders = updateById(state.workOrders, id, data)
    },
    deleteWorkOrder: (id: string) => {
      state.workOrders = removeById(state.workOrders, id)
    },
  }
  return state
}

function createFakeVehicles(vehicles: Vehicle[] = []) {
  const state = {
    vehicles,
    addVehicle: (data: Omit<Vehicle, 'id' | 'createdAt'>) => {
      const vehicle = newEntity(data)
      state.vehicles = [...state.vehicles, vehicle]
      return vehicle
    },
    getVehicle: (id: string) => state.vehicles.find((v) => v.id === id),
    updateVehicle: (id: string, data: Partial<Vehicle>) => {
      state.vehicles = updateById(state.vehicles, id, data)
    },
    deleteVehicle: (id: string) => {
      state.vehicles = removeById(state.vehicles, id)
    },
    // Same one-pass clear-the-sibling-flag semantics as the real store — see
    // src/store/vehicleStore.ts's setDefaultVehicle.
    setDefaultVehicle: (vehicleId: string) => {
      const target = state.vehicles.find((v) => v.id === vehicleId)
      if (!target) return
      state.vehicles = state.vehicles.map((v) => {
        const sameOwner = target.customerId ? v.customerId === target.customerId : v.companyId === target.companyId
        return sameOwner ? { ...v, isDefault: v.id === vehicleId } : v
      })
    },
  }
  return state
}

function createFakeScheduleRules(
  scheduleRules: ScheduleRule[] = [],
  now: () => Date = () => new Date(),
  orphanRepairedAt: string | null = null
) {
  const state = {
    scheduleRules,
    orphanRepairedAt,
    // Matches the real store's markOrphanRepaired — see
    // scheduleRuleStore.ts and src/lib/ops/scheduleRuleOrphanRepair.ts.
    markOrphanRepaired: (at: string) => {
      state.orphanRepairedAt = at
    },
    addRule: (data: Omit<ScheduleRule, 'id' | 'createdAt'>) => {
      const rule = newEntity(data)
      state.scheduleRules = [...state.scheduleRules, rule]
      return rule
    },
    supersedeRule: (id: string) => {
      state.scheduleRules = updateById(state.scheduleRules, id, {
        supersededAt: now().toISOString(),
      })
    },
    // Matches the real store's supersedeRules — see scheduleRuleStore.ts.
    supersedeRules: (ids: string[]) => {
      if (ids.length === 0) return
      const idSet = new Set(ids)
      const supersededAt = now().toISOString()
      state.scheduleRules = state.scheduleRules.map((r) => (idSet.has(r.id) ? { ...r, supersededAt } : r))
    },
    reviveRule: (id: string) => {
      state.scheduleRules = updateById(state.scheduleRules, id, { supersededAt: null })
    },
    // scheduleOps.ts's deleteScheduleRule looks up the rule's vehicle+item
    // pair before superseding its live siblings.
    getRule: (id: string) => state.scheduleRules.find((r) => r.id === id),
    // Matches the real store's newest-wins getActiveRule — see
    // scheduleRuleStore.ts's newestRule.
    getActiveRule: (vehicleId: string, itemTypeId: string) => newestRule(state.getActiveRules(vehicleId, itemTypeId)),
    getActiveRules: (vehicleId: string, itemTypeId: string) =>
      state.scheduleRules.filter(
        (r) => r.vehicleId === vehicleId && r.itemTypeId === itemTypeId && r.supersededAt === null
      ),
  }
  return state
}

function createFakeSettings(defaultServiceIntervalKm: number, defaultServiceIntervalMonths: number) {
  const state = { settings: { defaultServiceIntervalKm, defaultServiceIntervalMonths } }
  return state
}

function createFakeReminderFollowUps(
  seed: { id: string; vehicleId: string; contactedAt: string | null; snoozeUntil: string | null }[] = []
) {
  const state = {
    followUps: seed,
    // Upserts, matching src/store/reminderFollowUpStore.ts's real `clear` —
    // a vehicle with no follow-up row yet still ends up with one (all null),
    // it doesn't stay absent. getForVehicle must agree with the real store on
    // whether a row exists after this runs.
    clear: (vehicleId: string) => {
      const existing = state.followUps.find((f) => f.id === vehicleId)
      state.followUps = existing
        ? updateById(state.followUps, vehicleId, { contactedAt: null, snoozeUntil: null })
        : [...state.followUps, { id: vehicleId, vehicleId, contactedAt: null, snoozeUntil: null }]
    },
    getForVehicle: (vehicleId: string) => state.followUps.find((f) => f.id === vehicleId),
  }
  return state
}

function createFakeServiceEvents() {
  const state = {
    serviceEvents: [] as { id: string; workOrderId: string | null }[],
    addServiceEvent: (data: Record<string, unknown>) => {
      const event = newEntity(data) as unknown as { id: string; workOrderId: string | null }
      state.serviceEvents = [...state.serviceEvents, event]
      return event
    },
    deleteServiceEventsByWorkOrder: (workOrderId: string) => {
      state.serviceEvents = state.serviceEvents.filter((e) => e.workOrderId !== workOrderId)
    },
  }
  return state
}

function createFakeProductCategories(names: string[] = []) {
  const state = {
    categories: names.map((name) => newEntity({ name })),
    addProductCategory: (data: { name: string }) => {
      const category = newEntity(data)
      state.categories = [...state.categories, category]
      return category
    },
    getProductCategory: (id: string) => state.categories.find((c) => c.id === id),
    deleteProductCategory: (id: string) => {
      state.categories = removeById(state.categories, id)
    },
  }
  return state
}

function createFakeBays(bays: Bay[] = []) {
  const state = {
    bays,
    assignWorkOrder: (bayId: string, workOrderId: string, workerId: string | null, estimatedEndTime: string) => {
      state.bays = state.bays.map((b) =>
        b.id === bayId
          ? { ...b, status: 'in-service' as const, currentWorkOrderId: workOrderId, assignedWorkerId: workerId, estimatedEndTime }
          : b
      )
    },
    clearBay: (bayId: string) => {
      state.bays = state.bays.map((b) =>
        b.id === bayId
          ? { ...b, status: 'available' as const, currentWorkOrderId: null, assignedWorkerId: null, estimatedEndTime: null }
          : b
      )
    },
  }
  return state
}

function createFakeActivityLog(deviceId: string = 'test-device') {
  const state = {
    entries: [] as ActivityLogEntry[],
    record: (data: Omit<ActivityLogEntry, 'id' | 'createdAt' | 'deviceId'>) => {
      // Same shape the real store stamps on, using the same injected device id
      // every other fake in this file honors (seed.deviceId) rather than a
      // second hardcoded literal that could disagree with it.
      state.entries = [...state.entries, newEntity({ ...data, deviceId })]
    },
  }
  return state
}

/**
 * Unlike companies/workers/suppliers/serviceItemTypes below — which entityOps
 * only ever deletes from — customers also gets created through the ops layer
 * (entityOps.ts's createCustomer calls addCustomer), so it needs its own
 * factory rather than the delete-only createFakeList.
 */
function createFakeCustomers(customers: Customer[] = []) {
  const state = {
    customers,
    addCustomer: (data: Omit<Customer, 'id' | 'createdAt'>) => {
      const customer = newEntity(data)
      state.customers = [...state.customers, customer]
      return customer
    },
    deleteCustomer: (id: string) => {
      state.customers = removeById(state.customers, id)
    },
  }
  return state
}

/**
 * A generic list store for the entities ops only ever delete from. Takes the
 * delete action's real name (`deleteCustomer`, `deleteSupplier`, …) and builds
 * one object carrying both it and the list.
 *
 * Deliberately NOT spread into a wrapper afterwards: the delete closure
 * reassigns `state[field]` to a fresh array, so a `{ ...list }` copy would keep
 * pointing at the pre-delete array and every "the row is gone" assertion would
 * read stale state. Returning the single live object is what makes those
 * assertions mean anything.
 */
function createFakeList<T extends { id: string }>(
  field: string,
  deleteAction: string,
  items: T[] = []
) {
  const state: Record<string, unknown> = { [field]: items }
  state[deleteAction] = (id: string) => {
    state[field] = removeById(state[field] as T[], id)
  }
  return state as Record<string, T[]> & Record<string, (id: string) => void>
}

export interface FakeOpsWorld {
  deps: OpsDeps
  activityLog: ReturnType<typeof createFakeActivityLog>
  bays: ReturnType<typeof createFakeBays>
  inventory: ReturnType<typeof createFakeInventory>
  expenses: ReturnType<typeof createFakeExpenses>
  stockLots: ReturnType<typeof createFakeStockLots>
  movements: ReturnType<typeof createFakeMovements>
  workOrders: ReturnType<typeof createFakeWorkOrders>
  vehicles: ReturnType<typeof createFakeVehicles>
  scheduleRules: ReturnType<typeof createFakeScheduleRules>
  serviceEvents: ReturnType<typeof createFakeServiceEvents>
  productCategories: ReturnType<typeof createFakeProductCategories>
  customers: ReturnType<typeof createFakeCustomers>
  companies: { companies: unknown[]; deleteCompany: (id: string) => void }
  workers: { workers: unknown[]; deleteWorker: (id: string) => void }
  suppliers: { suppliers: unknown[]; deleteSupplier: (id: string) => void }
  serviceItemTypes: { serviceItemTypes: unknown[]; deleteServiceItemType: (id: string) => void }
  serviceCatalog: { services: unknown[] }
  settings: ReturnType<typeof createFakeSettings>
  reminderFollowUps: ReturnType<typeof createFakeReminderFollowUps>
}

export interface FakeWorldSeed {
  bays?: Bay[]
  products?: Product[]
  expenses?: Expense[]
  stockLots?: StockLot[]
  /** Seeds stockLotStore's one-time FIFO-backfill marker. */
  backfilledAt?: string | null
  movements?: StockMovement[]
  /** Seeds stockMovementStore's one-time ledger-backfill marker. */
  ledgerBackfilledAt?: string | null
  workOrders?: WorkOrder[]
  vehicles?: Vehicle[]
  scheduleRules?: ScheduleRule[]
  /** Seeds scheduleRuleStore's one-time orphaned-rule-cleanup marker. */
  orphanRepairedAt?: string | null
  categories?: string[]
  services?: unknown[]
  serviceItemTypes?: unknown[]
  customers?: { id: string }[]
  companies?: { id: string }[]
  workers?: { id: string }[]
  suppliers?: { id: string }[]
  /** Fixed clock — every occurredAt/receivedAt/date the ops stamp uses it. */
  now?: Date
  /** Who the ops should attribute activity-log entries to. Defaults to admin. */
  mode?: Mode
  /** This install's device id, for StockMovement attribution. Defaults to 'test-device'. */
  deviceId?: string
  /** Seeds settingsStore's fallback km interval. Defaults to 5,000, same as DEFAULT_SERVICE_INTERVAL_KM. */
  defaultServiceIntervalKm?: number
  /** Seeds settingsStore's fallback months interval. Defaults to 4, same as DEFAULT_SERVICE_INTERVAL_MONTHS. */
  defaultServiceIntervalMonths?: number
  reminderFollowUps?: { id: string; vehicleId: string; contactedAt: string | null; snoozeUntil: string | null }[]
}

export function buildFakeOpsDeps(seed: FakeWorldSeed = {}): FakeOpsWorld {
  // Declared before any fake that needs to honor them (scheduleRules'
  // supersedeRule, activityLog's record) — every occurredAt/receivedAt/date
  // the ops stamp uses `now()`/`deviceId`, and the fakes must actually read
  // these rather than reaching for their own Date.now()/literal, or a test
  // pinning `seed.now` wouldn't really pin anything.
  const fixedNow = seed.now ?? new Date('2026-08-10T09:00:00.000Z')
  const fixedMode: Mode = seed.mode ?? 'admin'
  const fixedDeviceId = seed.deviceId ?? 'test-device'

  const bays = createFakeBays(seed.bays ?? [])
  const inventory = createFakeInventory(seed.products ?? [])
  const expenses = createFakeExpenses(seed.expenses ?? [])
  const stockLots = createFakeStockLots(seed.stockLots ?? [], seed.backfilledAt ?? null)
  const movements = createFakeMovements(seed.movements ?? [], seed.ledgerBackfilledAt ?? null)
  const workOrders = createFakeWorkOrders(seed.workOrders ?? [])
  const vehicles = createFakeVehicles(seed.vehicles ?? [])
  const scheduleRules = createFakeScheduleRules(seed.scheduleRules ?? [], () => fixedNow, seed.orphanRepairedAt ?? null)
  const serviceEvents = createFakeServiceEvents()
  const productCategories = createFakeProductCategories(seed.categories ?? [])

  // Seed items may be partial (existing tests pass just { id }), same as
  // every other fake here — addCustomer only needs the array shape to line up
  // for the *new* customers it appends, not for whatever the test seeded.
  const customers = createFakeCustomers((seed.customers ?? []) as Customer[])
  const companies = createFakeList('companies', 'deleteCompany', seed.companies ?? [])
  const workers = createFakeList('workers', 'deleteWorker', seed.workers ?? [])
  const suppliers = createFakeList('suppliers', 'deleteSupplier', seed.suppliers ?? [])
  const serviceItemTypes = createFakeList(
    'serviceItemTypes',
    'deleteServiceItemType',
    (seed.serviceItemTypes ?? []) as { id: string }[]
  )
  const serviceCatalog = { services: seed.services ?? [] }
  const activityLog = createFakeActivityLog(fixedDeviceId)
  const settings = createFakeSettings(seed.defaultServiceIntervalKm ?? 5000, seed.defaultServiceIntervalMonths ?? 4)
  const reminderFollowUps = createFakeReminderFollowUps(seed.reminderFollowUps ?? [])

  const deps = {
    activityLog: handle(activityLog),
    bays: handle(bays),
    inventory: handle(inventory),
    expenses: handle(expenses),
    stockLots: handle(stockLots),
    movements: handle(movements),
    workOrders: handle(workOrders),
    vehicles: handle(vehicles),
    scheduleRules: handle(scheduleRules),
    serviceEvents: handle(serviceEvents),
    productCategories: handle(productCategories),
    customers: handle(customers),
    companies: handle(companies),
    workers: handle(workers),
    suppliers: handle(suppliers),
    serviceItemTypes: handle(serviceItemTypes),
    serviceCatalog: handle(serviceCatalog),
    settings: handle(settings),
    reminderFollowUps: handle(reminderFollowUps),
    now: () => fixedNow,
    mode: () => fixedMode,
    deviceId: () => fixedDeviceId,
  } as unknown as OpsDeps

  return {
    deps,
    activityLog,
    bays,
    inventory,
    expenses,
    stockLots,
    movements,
    workOrders,
    vehicles,
    scheduleRules,
    serviceEvents,
    productCategories,
    customers,
    companies: companies as unknown as FakeOpsWorld['companies'],
    workers: workers as unknown as FakeOpsWorld['workers'],
    suppliers: suppliers as unknown as FakeOpsWorld['suppliers'],
    serviceItemTypes: serviceItemTypes as unknown as FakeOpsWorld['serviceItemTypes'],
    serviceCatalog,
    settings,
    reminderFollowUps,
  }
}
