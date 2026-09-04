// How to wake each store's live state back up after the engine merges a
// remote change into its persisted blob. Waking up uses zustand's own
// persist.rehydrate() — re-reads through storageAdapter and applies it to
// in-memory state — so no individual store needs a bespoke "apply a remote
// row" action; every store here is completely unmodified by sync, all the
// way down to entityHelpers.ts.
//
// *Which* fields sync and how (list/singleton/append) now lives in
// ./syncFields.ts, store-free and Node-safe. This file supplies only the
// one thing that genuinely needs real store instances — the rehydrate
// callbacks — because store imports can't be shared with the sync server the
// way syncFields.ts's plain data can.
//
// Deliberately separate from src/lib/persistence.ts's PERSISTED_STORES
// (backup/restore registry): that one is intentionally decoupled from every
// store module (string keys only) so backup/restore never has to import
// eighteen stores. Sync has no such option here — it gets its own registry
// instead of dragging store imports into persistence.ts.
import { useCustomerStore } from '../../store/customerStore'
import { useCompanyStore } from '../../store/companyStore'
import { useVehicleStore } from '../../store/vehicleStore'
import { useWorkerStore } from '../../store/workerStore'
import { useWorkOrderStore } from '../../store/workOrderStore'
import { useInventoryStore } from '../../store/inventoryStore'
import { useStockLotStore } from '../../store/stockLotStore'
import { useStockMovementStore } from '../../store/stockMovementStore'
import { useSupplierStore } from '../../store/supplierStore'
import { useExpenseStore } from '../../store/expenseStore'
import { useSettingsStore } from '../../store/settingsStore'
import { useSecurityStore } from '../../store/securityStore'
import { useActivityLogStore } from '../../store/activityLogStore'
import { useServiceItemTypeStore } from '../../store/serviceItemTypeStore'
import { useProductCategoryStore } from '../../store/productCategoryStore'
import { useServiceCatalogStore } from '../../store/serviceCatalogStore'
import { useScheduleRuleStore } from '../../store/scheduleRuleStore'
import { useServiceEventStore } from '../../store/serviceEventStore'
import { useReminderFollowUpStore } from '../../store/reminderFollowUpStore'
import { useLanguageStore } from '../../store/languageStore'
import { useAppointmentStore } from '../../store/appointmentStore'
import { useBayStore } from '../../store/bayStore'
import type { SyncKind } from './types'
import { SYNC_UNIT_SPECS } from './syncFields'
import type { StoreKey } from '../storageKeys'

export interface SyncUnit {
  storageKey: string
  kind: SyncKind
  itemsField: string
  /** The store's persisted-store version — see STORE_VERSIONS in
   *  ./syncFields.ts, which is where this actually comes from (via
   *  SYNC_UNIT_SPECS below); needed by applyOpsToBlob whenever it has to
   *  fabricate a fresh envelope for a store with no local blob yet. */
  version: number
  rehydrate: () => void
}

function rehydrator(store: { persist: { rehydrate: () => unknown } }): () => void {
  return () => {
    void store.persist.rehydrate()
  }
}

/**
 * Record<StoreKey, …>, same enforcement as SYNC_FIELDS in syncFields.ts: a
 * store registered in PERSISTED_STORES without a rehydrator here is a
 * compile error, not a store that silently never wakes up after a remote
 * merge.
 */
const REHYDRATORS: Record<StoreKey, () => void> = {
  'customer-store': rehydrator(useCustomerStore),
  'company-store': rehydrator(useCompanyStore),
  'vehicle-store': rehydrator(useVehicleStore),
  'worker-store': rehydrator(useWorkerStore),
  'work-order-store': rehydrator(useWorkOrderStore),
  'inventory-store': rehydrator(useInventoryStore),
  'stock-lot-store': rehydrator(useStockLotStore),
  'stock-movement-store': rehydrator(useStockMovementStore),
  'supplier-store': rehydrator(useSupplierStore),
  'expense-store': rehydrator(useExpenseStore),
  'settings-store': rehydrator(useSettingsStore),
  'security-store': rehydrator(useSecurityStore),
  'activity-log-store': rehydrator(useActivityLogStore),
  'service-item-type-store': rehydrator(useServiceItemTypeStore),
  'product-category-store': rehydrator(useProductCategoryStore),
  'service-catalog-store': rehydrator(useServiceCatalogStore),
  'schedule-rule-store': rehydrator(useScheduleRuleStore),
  'service-event-store': rehydrator(useServiceEventStore),
  'reminder-follow-up-store': rehydrator(useReminderFollowUpStore),
  'language-store': rehydrator(useLanguageStore),
  'appointment-storage': rehydrator(useAppointmentStore),
  'bay-storage': rehydrator(useBayStore),
}

export const SYNC_UNITS: SyncUnit[] = SYNC_UNIT_SPECS.map((spec) => ({
  ...spec,
  rehydrate: REHYDRATORS[spec.storageKey],
}))
