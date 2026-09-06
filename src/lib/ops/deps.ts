// The seam between the ops layer and the stores it drives.
//
// Before this, every op reached module-level singletons directly
// (`useInventoryStore.getState()`, ~57 call sites), which meant the only way to
// exercise one was to boot the real stores — so orderOps, entityOps and
// scheduleOps had no tests at all, and inventoryOps tested only its one pure
// function while ~40 lines of lot-clamping arithmetic went uncovered.
//
// Same idiom as src/lib/sync/engine.ts, deliberately: a `create*Ops(deps)`
// factory, one `realOpsDeps` wiring to the live singletons, and thin named
// exports on top so no call site had to move.
//
// Each store arrives as a `Store<typeof useXStore, 'a' | 'b'>` — the real
// store's type, narrowed with Pick to the members the ops layer actually
// touches. Two things follow from that, both load-bearing:
//
//   - Member *signatures* are still derived from the real store, so a store
//     changing an action's shape is a compile error here, not a surprise at
//     runtime.
//   - The surface is small enough that a fake can satisfy it honestly.
//     fakeOpsDeps.ts used to end with `as unknown as OpsDeps` because it
//     implemented ~48 of the ~121 members the full store types demanded — and
//     that cast switched off the very checking this seam exists to provide:
//     a store renaming an action left the fake compiling and every ops test
//     passing against a shape production no longer had. That had already
//     happened once (see entityOps.test.ts's createCustomer note).
//
// Widen a Pick when an op genuinely needs another member; don't reach for a
// cast.
import { useActivityLogStore } from '../../store/activityLogStore'
import { currentMode } from '../../store/authStore'
import { getDeviceId } from '../deviceId'
import type { Mode } from '../auth/permissions'
import { useBayStore } from '../../store/bayStore'
import { useCompanyStore } from '../../store/companyStore'
import { useCustomerStore } from '../../store/customerStore'
import { useExpenseStore } from '../../store/expenseStore'
import { useInventoryStore } from '../../store/inventoryStore'
import { useProductCategoryStore } from '../../store/productCategoryStore'
import { useReminderFollowUpStore } from '../../store/reminderFollowUpStore'
import { useScheduleRuleStore } from '../../store/scheduleRuleStore'
import { useServiceCatalogStore } from '../../store/serviceCatalogStore'
import { useServiceEventStore } from '../../store/serviceEventStore'
import { useServiceItemTypeStore } from '../../store/serviceItemTypeStore'
import { useSettingsStore } from '../../store/settingsStore'
import { useStockLotStore } from '../../store/stockLotStore'
import { useStockMovementStore } from '../../store/stockMovementStore'
import { useSupplierStore } from '../../store/supplierStore'
import { useVehicleStore } from '../../store/vehicleStore'
import { useWorkOrderStore } from '../../store/workOrderStore'
import { useWorkerStore } from '../../store/workerStore'

/**
 * Just enough of a zustand store for an op to use. A test supplies any object
 * with a `getState()` — no React, no persistence, no global state shared
 * between test files.
 */
export interface StoreHandle<T> {
  getState(): T
}

/**
 * A store handle exposing only `Keys` of the store `S`. `S` is the hook itself
 * (`typeof useCustomerStore`), so the member types come straight from the real
 * store and can't be hand-typed into drift.
 */
export type Store<S extends { getState: () => unknown }, Keys extends keyof ReturnType<S['getState']>> =
  StoreHandle<Pick<ReturnType<S['getState']>, Keys>>

export interface OpsDeps {
  activityLog: Store<typeof useActivityLogStore, 'record'>
  bays: Store<typeof useBayStore, 'assignWorkOrder' | 'bays' | 'clearBay' | 'updateBay'>
  companies: Store<typeof useCompanyStore, 'companies' | 'addCompany' | 'updateCompany' | 'deleteCompany' | 'deleteDriver'>
  customers: Store<typeof useCustomerStore, 'customers' | 'addCustomer' | 'updateCustomer' | 'deleteCustomer'>
  expenses: Store<typeof useExpenseStore, 'expenses' | 'getExpense' | 'addExpense' | 'updateExpense' | 'deleteExpense'>
  inventory: Store<typeof useInventoryStore, 'products' | 'getProduct' | 'addProduct' | 'addProducts' | 'updateProduct' | 'deleteProduct'>
  movements: Store<typeof useStockMovementStore, 'addMovement' | 'ledgerBackfilledAt' | 'markLedgerBackfilled' | 'movements'>
  productCategories: Store<typeof useProductCategoryStore, 'addProductCategory' | 'categories' | 'deleteProductCategory' | 'getProductCategory'>
  reminderFollowUps: Store<typeof useReminderFollowUpStore, 'clear'>
  scheduleRules: Store<typeof useScheduleRuleStore, 'addRule' | 'getActiveRule' | 'getActiveRules' | 'getRule' | 'markOrphanRepaired' | 'orphanRepairedAt' | 'reviveRule' | 'scheduleRules' | 'supersedeRule' | 'supersedeRules'>
  serviceCatalog: Store<typeof useServiceCatalogStore, 'services' | 'addServices' | 'updateService'>
  serviceEvents: Store<typeof useServiceEventStore, 'addServiceEvent' | 'deleteServiceEventsByWorkOrder'>
  serviceItemTypes: Store<typeof useServiceItemTypeStore, 'addServiceItemType' | 'deleteServiceItemType' | 'serviceItemTypes'>
  settings: Store<typeof useSettingsStore, 'settings'>
  stockLots: Store<typeof useStockLotStore, 'addLot' | 'backfilledAt' | 'getLotsByProduct' | 'markBackfilled' | 'stockLots'>
  suppliers: Store<typeof useSupplierStore, 'suppliers' | 'deleteSupplier'>
  vehicles: Store<typeof useVehicleStore, 'addVehicle' | 'deleteVehicle' | 'getVehicle' | 'setDefaultVehicle' | 'updateVehicle' | 'vehicles'>
  workOrders: Store<typeof useWorkOrderStore, 'deleteWorkOrder' | 'getWorkOrder' | 'updateWorkOrder' | 'workOrders'>
  workers: Store<typeof useWorkerStore, 'workers' | 'deleteWorker'>
  /**
   * Injected so a test can pin every `occurredAt`/`receivedAt`/`date` stamp.
   * Ops write timestamps into the append-only stock ledger, where "what time
   * did this happen" is part of the data, not incidental.
   */
  now: () => Date
  /**
   * Who is acting, for activity-log attribution. Ambient like `now` and
   * injected for the same reason: the value is part of the record an op writes,
   * so a test has to be able to pin it.
   */
  mode: () => Mode
  /**
   * This install's device id, for StockMovement attribution
   * (src/store/stockMovementStore.ts). Same reasoning as `mode`: a movement's
   * deviceId is part of the record, so a test has to be able to pin it rather
   * than have the store reach out to src/lib/deviceId.ts on its own.
   */
  deviceId: () => string
}

/** The one real wiring the running app uses. */
export const realOpsDeps: OpsDeps = {
  activityLog: useActivityLogStore,
  bays: useBayStore,
  companies: useCompanyStore,
  customers: useCustomerStore,
  expenses: useExpenseStore,
  inventory: useInventoryStore,
  movements: useStockMovementStore,
  productCategories: useProductCategoryStore,
  reminderFollowUps: useReminderFollowUpStore,
  scheduleRules: useScheduleRuleStore,
  serviceCatalog: useServiceCatalogStore,
  serviceEvents: useServiceEventStore,
  serviceItemTypes: useServiceItemTypeStore,
  settings: useSettingsStore,
  stockLots: useStockLotStore,
  suppliers: useSupplierStore,
  vehicles: useVehicleStore,
  workOrders: useWorkOrderStore,
  workers: useWorkerStore,
  now: () => new Date(),
  mode: currentMode,
  deviceId: getDeviceId,
}
