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
// Typed as ReturnType<typeof useXStore.getState> rather than the stores' own
// interfaces because those interfaces aren't exported — and shouldn't have to
// be, just to describe a dependency.
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

export interface OpsDeps {
  activityLog: StoreHandle<ReturnType<typeof useActivityLogStore.getState>>
  bays: StoreHandle<ReturnType<typeof useBayStore.getState>>
  companies: StoreHandle<ReturnType<typeof useCompanyStore.getState>>
  customers: StoreHandle<ReturnType<typeof useCustomerStore.getState>>
  expenses: StoreHandle<ReturnType<typeof useExpenseStore.getState>>
  inventory: StoreHandle<ReturnType<typeof useInventoryStore.getState>>
  movements: StoreHandle<ReturnType<typeof useStockMovementStore.getState>>
  productCategories: StoreHandle<ReturnType<typeof useProductCategoryStore.getState>>
  reminderFollowUps: StoreHandle<ReturnType<typeof useReminderFollowUpStore.getState>>
  scheduleRules: StoreHandle<ReturnType<typeof useScheduleRuleStore.getState>>
  serviceCatalog: StoreHandle<ReturnType<typeof useServiceCatalogStore.getState>>
  serviceEvents: StoreHandle<ReturnType<typeof useServiceEventStore.getState>>
  serviceItemTypes: StoreHandle<ReturnType<typeof useServiceItemTypeStore.getState>>
  settings: StoreHandle<ReturnType<typeof useSettingsStore.getState>>
  stockLots: StoreHandle<ReturnType<typeof useStockLotStore.getState>>
  suppliers: StoreHandle<ReturnType<typeof useSupplierStore.getState>>
  vehicles: StoreHandle<ReturnType<typeof useVehicleStore.getState>>
  workOrders: StoreHandle<ReturnType<typeof useWorkOrderStore.getState>>
  workers: StoreHandle<ReturnType<typeof useWorkerStore.getState>>
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
