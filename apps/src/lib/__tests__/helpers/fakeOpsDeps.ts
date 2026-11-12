// In-memory stand-ins for the stores the ops layer drives, for the ops tests.
//
// Not a .test.ts file, so vitest's include glob (src/**/*.test.ts) treats it as
// a plain module rather than an empty suite.
//
// Each fake reimplements only the actions ops actually call, using the same
// entityHelpers the real stores use so ids, createdAt stamps and by-id updates
// behave identically.
//
// `buildFakeOpsDeps` ends in `satisfies OpsDeps`, NOT a cast. It used to end in
// `as unknown as OpsDeps`, because OpsDeps demanded whole store interfaces
// (~121 members) and the fakes implemented ~48 — and that cast switched off the
// only check that mattered here: a store renaming an action left this file
// compiling and every ops test passing against a shape production no longer
// had. OpsDeps now Picks just the members ops touch (see src/lib/ops/deps.ts),
// which is small enough to satisfy honestly. Turning the cast off immediately
// surfaced five real gaps, including a `bays` fake with no `updateBay` at all
// while orderOps calls it.
//
// So: if a fake stops satisfying OpsDeps, that is the seam working. Add the
// member; don't reach for a cast.
import { newEntity, removeById, updateById } from '../../../store/entityHelpers'
import type { OpsDeps, StoreHandle } from '../../ops/deps'
import type { Product } from '../../../store/inventoryStore'
import type { Expense } from '../../../store/expenseStore'
import type { StockLot } from '../../../store/stockLotStore'
import type { StockMovement } from '../../../store/stockMovementStore'
import type { WorkOrder, WorkOrderItem } from '../../../store/workOrderStore'
import type { Vehicle } from '../../../store/vehicleStore'
import type { ServiceCatalogItem } from '../../../store/serviceCatalogStore'
import { newestRule, type ScheduleRule } from '../../../store/scheduleRuleStore'
import type { ActivityLogEntry } from '../../../store/activityLogStore'
import type { Bay } from '../../../store/bayStore'
import type { Appointment } from '../../../store/appointmentStore'
import type { ReminderFollowUp } from '../../../store/reminderFollowUpStore'
import type { Customer } from '../../../store/customerStore'
import type { Company } from '../../../store/companyStore'
import { defaultSettings } from '../../../store/settingsStore'
import type { ServiceItemType } from '../../../store/serviceItemTypeStore'
import type { ServiceEvent } from '../../../store/serviceEventStore'
import type { Supplier } from '../../../store/supplierStore'
import type { Worker } from '../../../store/workerStore'
import type { Mode } from '../../auth/permissions'
import { lineTotal } from '../../orders/orderTotals'

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
    updateExpense: (id: string, data: Partial<Expense>) => {
      state.expenses = state.expenses.map((e) => (e.id === id ? { ...e, ...data } : e))
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
    // One call = one "write", like the real store's single set().
    addMovements: (list: Omit<StockMovement, 'id' | 'createdAt'>[]) => {
      const added = list.map((data) => newEntity(data))
      state.movements = [...state.movements, ...added]
      state.bulkWrites += 1
      return added
    },
    /** How many times addMovements ran — lets a test assert a completion wrote the ledger once. */
    bulkWrites: 0,
    markLedgerBackfilled: (at: string) => {
      state.ledgerBackfilledAt = at
    },
  }
  return state
}

function createFakeWorkOrders(workOrders: WorkOrder[] = []) {
  let lineSeq = 0
  const state = {
    workOrders,
    // Numbered from the highest on hand, same rule as the real store.
    addWorkOrders: (list: Omit<WorkOrder, 'id' | 'orderNumber' | 'createdAt'>[]) => {
      const first = state.workOrders.reduce((m, w) => Math.max(m, w.orderNumber), 1000) + 1
      const created: WorkOrder[] = list.map((d, i) => ({ ...newEntity(d), orderNumber: first + i }))
      state.workOrders = [...state.workOrders, ...created]
      return created
    },
    getWorkOrder: (id: string) => state.workOrders.find((w) => w.id === id),
    updateWorkOrder: (id: string, data: Partial<WorkOrder>) => {
      state.workOrders = updateById(state.workOrders, id, data)
    },
    deleteWorkOrder: (id: string) => {
      state.workOrders = removeById(state.workOrders, id)
    },
    reassignVehicle: (fromIds: string[], toId: string) => {
      state.workOrders = state.workOrders.map((w) => (fromIds.includes(w.vehicleId) ? { ...w, vehicleId: toId } : w))
    },
    // Line edits, with the store's own lineTotal rule (orderOps tests don't
    // read totals; orderLineOps tests read lines).
    addItem: (workOrderId: string, item: Omit<WorkOrderItem, 'id' | 'lineTotal'>) => {
      const line: WorkOrderItem = { ...item, id: `line-${++lineSeq}`, lineTotal: lineTotal(item.quantity, item.unitPrice) }
      state.workOrders = state.workOrders.map((w) => (w.id === workOrderId ? { ...w, items: [...w.items, line] } : w))
    },
    updateItem: (workOrderId: string, itemId: string, data: Partial<WorkOrderItem>) => {
      state.workOrders = state.workOrders.map((w) =>
        w.id === workOrderId
          ? { ...w, items: w.items.map((i) => (i.id === itemId ? { ...i, ...data, lineTotal: lineTotal(data.quantity ?? i.quantity, data.unitPrice ?? i.unitPrice) } : i)) }
          : w
      )
    },
    removeItem: (workOrderId: string, itemId: string) => {
      state.workOrders = state.workOrders.map((w) => (w.id === workOrderId ? { ...w, items: w.items.filter((i) => i.id !== itemId) } : w))
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
    addVehicles: (list: Omit<Vehicle, 'id' | 'createdAt'>[]) => {
      const created = list.map((d) => newEntity(d))
      state.vehicles = [...state.vehicles, ...created]
      return created
    },
    getVehicle: (id: string) => state.vehicles.find((v) => v.id === id),
    updateVehicle: (id: string, data: Partial<Vehicle>) => {
      state.vehicles = updateById(state.vehicles, id, data)
    },
    deleteVehicle: (id: string) => {
      state.vehicles = removeById(state.vehicles, id)
    },
    deleteVehicles: (ids: string[]) => {
      state.vehicles = state.vehicles.filter((v) => !ids.includes(v.id))
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
    reassignVehicle: (fromIds: string[], toId: string) => {
      state.scheduleRules = state.scheduleRules.map((r) => (fromIds.includes(r.vehicleId) ? { ...r, vehicleId: toId } : r))
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
  // A whole Settings, built off the store's own default rather than the two
  // fields the schedule ops happen to read: OpsDeps asks for `settings`, and
  // `settings` means Settings. Two fields in a trench coat only type-checked
  // while fakeOpsDeps ended in a cast.
  const state = { settings: { ...defaultSettings, defaultServiceIntervalKm, defaultServiceIntervalMonths } }
  return state
}

function createFakeReminderFollowUps(
  seed: { id: string; vehicleId: string; contactedAt: string | null; snoozeUntil: string | null; createdAt?: string }[] = []
) {
  const state = {
    followUps: seed.map((f): ReminderFollowUp => ({ createdAt: '2026-01-01T00:00:00.000Z', ...f })),
    // Upserts, matching src/store/reminderFollowUpStore.ts's real `clear` —
    // a vehicle with no follow-up row yet still ends up with one (all null),
    // it doesn't stay absent. getForVehicle must agree with the real store on
    // whether a row exists after this runs.
    clear: (vehicleId: string) => {
      const existing = state.followUps.find((f) => f.id === vehicleId)
      state.followUps = existing
        ? updateById(state.followUps, vehicleId, { contactedAt: null, snoozeUntil: null })
        : [...state.followUps, { id: vehicleId, vehicleId, contactedAt: null, snoozeUntil: null, createdAt: '2026-01-01T00:00:00.000Z' }]
    },
    getForVehicle: (vehicleId: string) => state.followUps.find((f) => f.id === vehicleId),
    replaceForVehicles: (vehicleIds: string[], keep: ReminderFollowUp | null) => {
      state.followUps = [...state.followUps.filter((f) => !vehicleIds.includes(f.vehicleId)), ...(keep ? [keep] : [])]
    },
  }
  return state
}

function createFakeServiceEvents(serviceEvents: ServiceEvent[] = []) {
  const state = {
    serviceEvents,
    reassignVehicle: (fromIds: string[], toId: string) => {
      state.serviceEvents = state.serviceEvents.map((e) => (fromIds.includes(e.vehicleId) ? { ...e, vehicleId: toId } : e))
    },
    addServiceEvent: (data: Omit<ServiceEvent, 'id' | 'createdAt'>) => {
      const event = newEntity(data) as ServiceEvent
      state.serviceEvents = [...state.serviceEvents, event]
      return event
    },
    deleteServiceEventsByWorkOrder: (workOrderId: string) => {
      state.serviceEvents = state.serviceEvents.filter((e) => e.workOrderId !== workOrderId)
    },
  }
  return state
}

function createFakeAppointments(appointments: Appointment[] = []) {
  const state = {
    appointments,
    reassignVehicle: (fromIds: string[], toId: string) => {
      state.appointments = state.appointments.map((a) =>
        a.vehicleId !== null && fromIds.includes(a.vehicleId) ? { ...a, vehicleId: toId } : a
      )
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

/** Unlike the delete-only createFakeList below, this one also supports
 *  creation — src/lib/ops/serviceCatalogOps.ts's applyServiceImport
 *  auto-creates a schedule tag the file names but the shop doesn't have
 *  yet, same as createFakeProductCategories does for product categories. */
function createFakeServiceItemTypes(items: ServiceItemType[] = []) {
  const state = {
    serviceItemTypes: items,
    addServiceItemType: (data: Omit<ServiceItemType, 'id' | 'createdAt'>) => {
      const itemType = newEntity(data) as ServiceItemType
      state.serviceItemTypes = [...state.serviceItemTypes, itemType]
      return itemType
    },
    deleteServiceItemType: (id: string) => {
      state.serviceItemTypes = removeById(state.serviceItemTypes, id)
    },
  }
  return state
}

/** Unlike the plain `{ services }` object this replaces, this one supports
 *  the batch addServices and per-row updateService applyServiceImport
 *  needs. */
function createFakeServiceCatalog(services: ServiceCatalogItem[] = []) {
  const state = {
    services,
    addServices: (list: Omit<ServiceCatalogItem, 'id' | 'createdAt'>[]) => {
      const created = list.map((d) => newEntity(d))
      state.services = [...state.services, ...created]
      return created
    },
    updateService: (id: string, data: Partial<ServiceCatalogItem>) => {
      state.services = updateById(state.services, id, data)
    },
  }
  return state
}

function createFakeBays(bays: Bay[] = []) {
  const state = {
    bays,
    updateBay: (id: string, updates: Partial<Bay>) => {
      state.bays = updateById(state.bays, id, updates)
    },
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
/** Delete-only stores, but nominally typed — see createFakeList. */
function createFakeWorkers(items: Worker[] = []) {
  return createFakeList('workers', 'deleteWorker', items)
}

function createFakeSuppliers(items: Supplier[] = []) {
  return createFakeList('suppliers', 'deleteSupplier', items)
}

function createFakeCustomers(customers: Customer[] = []) {
  const state = {
    customers,
    addCustomer: (data: Omit<Customer, 'id' | 'createdAt'>) => {
      const customer = newEntity(data)
      state.customers = [...state.customers, customer]
      return customer
    },
    addCustomers: (list: Omit<Customer, 'id' | 'createdAt'>[]) => {
      const created = list.map((d) => newEntity(d))
      state.customers = [...state.customers, ...created]
      return created
    },
    updateCustomer: (id: string, data: Partial<Customer>) => {
      state.customers = updateById(state.customers, id, data)
    },
    deleteCustomer: (id: string) => {
      state.customers = removeById(state.customers, id)
    },
  }
  return state
}

/**
 * Companies were a createFakeList (delete-only) until entityOps grew
 * createCompany/updateCompanyLogged/deleteDriverChecked — the same gap
 * createFakeCustomers's doc describes, and with the same failure mode: the
 * call would have thrown "addCompany is not a function" at runtime with
 * nothing failing at compile time. Drivers live inside the company row rather
 * than in a store of their own (see AGENTS.md's glossary), so deleteDriver edits the
 * owning company in place.
 */
function createFakeCompanies(companies: Company[] = []) {
  const state = {
    companies,
    addCompany: (data: Omit<Company, 'id' | 'createdAt' | 'drivers'>) => {
      const company = { ...newEntity(data), drivers: [] } as Company
      state.companies = [...state.companies, company]
      return company
    },
    addCompanies: (list: Omit<Company, 'id' | 'createdAt' | 'drivers'>[]) => {
      const created: Company[] = list.map((d) => ({ ...newEntity(d), drivers: [] }))
      state.companies = [...state.companies, ...created]
      return created
    },
    updateCompany: (id: string, data: Partial<Company>) => {
      state.companies = updateById(state.companies, id, data)
    },
    deleteCompany: (id: string) => {
      state.companies = removeById(state.companies, id)
    },
    deleteDriver: (companyId: string, driverId: string) => {
      state.companies = state.companies.map((c) =>
        c.id === companyId ? { ...c, drivers: removeById(c.drivers ?? [], driverId) } : c
      )
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
function createFakeList<T extends { id: string }, F extends string, D extends string>(
  field: F,
  deleteAction: D,
  items: T[] = []
): { [K in F]: T[] } & { [K in D]: (id: string) => void } {
  const state: Record<string, unknown> = { [field]: items }
  state[deleteAction] = (id: string) => {
    state[field] = removeById(state[field] as T[], id)
  }
  // The one unavoidable assertion in this file: the keys are only known at
  // runtime, so the object has to be built untyped and asserted once here.
  // Confined to three lines with a fully typed signature around it — unlike
  // the file-wide `as unknown as OpsDeps` this replaces, it can't hide a
  // missing member from a caller.
  return state as { [K in F]: T[] } & { [K in D]: (id: string) => void }
}

export interface FakeOpsWorld {
  deps: OpsDeps
  activityLog: ReturnType<typeof createFakeActivityLog>
  appointments: ReturnType<typeof createFakeAppointments>
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
  companies: ReturnType<typeof createFakeCompanies>
  workers: ReturnType<typeof createFakeWorkers>
  suppliers: ReturnType<typeof createFakeSuppliers>
  serviceItemTypes: ReturnType<typeof createFakeServiceItemTypes>
  serviceCatalog: ReturnType<typeof createFakeServiceCatalog>
  settings: ReturnType<typeof createFakeSettings>
  reminderFollowUps: ReturnType<typeof createFakeReminderFollowUps>
}

export interface FakeWorldSeed {
  appointments?: Appointment[]
  bays?: Bay[]
  serviceEvents?: ServiceEvent[]
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
  const serviceEvents = createFakeServiceEvents(seed.serviceEvents ?? [])
  const appointments = createFakeAppointments(seed.appointments ?? [])
  const productCategories = createFakeProductCategories(seed.categories ?? [])

  // Seed items may be partial (existing tests pass just { id }), same as
  // every other fake here — addCustomer only needs the array shape to line up
  // for the *new* customers it appends, not for whatever the test seeded.
  const customers = createFakeCustomers((seed.customers ?? []) as Customer[])
  const companies = createFakeCompanies((seed.companies ?? []) as Company[])
  const workers = createFakeWorkers((seed.workers ?? []) as Worker[])
  const suppliers = createFakeSuppliers((seed.suppliers ?? []) as Supplier[])
  // Loosely typed at the seed boundary (existing tests pass partial service
  // objects carrying only the fields the schedule logic under test actually
  // reads) — cast here, same pattern this file already uses for customers.
  const serviceItemTypes = createFakeServiceItemTypes((seed.serviceItemTypes ?? []) as ServiceItemType[])
  const serviceCatalog = createFakeServiceCatalog((seed.services ?? []) as ServiceCatalogItem[])
  const activityLog = createFakeActivityLog(fixedDeviceId)
  const settings = createFakeSettings(seed.defaultServiceIntervalKm ?? 5000, seed.defaultServiceIntervalMonths ?? 4)
  const reminderFollowUps = createFakeReminderFollowUps(seed.reminderFollowUps ?? [])

  const deps = {
    activityLog: handle(activityLog),
    appointments: handle(appointments),
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
  } satisfies OpsDeps

  return {
    deps,
    activityLog,
    appointments,
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
    companies,
    workers,
    suppliers,
    serviceItemTypes,
    serviceCatalog,
    settings,
    reminderFollowUps,
  }
}
