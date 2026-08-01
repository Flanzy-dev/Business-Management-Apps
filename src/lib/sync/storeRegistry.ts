// Which store fields sync, and how to wake each store's live state back up
// after the engine merges a remote change into its persisted blob. Waking up
// uses zustand's own persist.rehydrate() — re-reads through storageAdapter
// and applies it to in-memory state — so no individual store needs a
// bespoke "apply a remote row" action; every store here is completely
// unmodified by sync, all the way down to entityHelpers.ts.
//
// Deliberately separate from src/lib/persistence.ts's PERSISTED_STORES
// (backup/restore registry): that one is intentionally decoupled from every
// store module (string keys only) so backup/restore never has to import
// eighteen stores. Sync has no such option — it has to trigger rehydration
// on the real store instances — so it gets its own registry instead of
// dragging store imports into persistence.ts.
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
import { useServiceItemTypeStore } from '../../store/serviceItemTypeStore'
import { useProductCategoryStore } from '../../store/productCategoryStore'
import { useServiceCatalogStore } from '../../store/serviceCatalogStore'
import { useScheduleRuleStore } from '../../store/scheduleRuleStore'
import { useServiceEventStore } from '../../store/serviceEventStore'
import { useLanguageStore } from '../../store/languageStore'
import { useAppointmentStore } from '../../store/appointmentStore'
import { useBayStore } from '../../store/bayStore'
import type { SyncKind } from './types'

export interface SyncUnit {
  storageKey: string
  kind: SyncKind
  itemsField: string
  rehydrate: () => void
}

function rehydrator(store: { persist: { rehydrate: () => unknown } }): () => void {
  return () => {
    void store.persist.rehydrate()
  }
}

export const SYNC_UNITS: SyncUnit[] = [
  { storageKey: 'customer-store', kind: 'list', itemsField: 'customers', rehydrate: rehydrator(useCustomerStore) },
  { storageKey: 'company-store', kind: 'list', itemsField: 'companies', rehydrate: rehydrator(useCompanyStore) },
  { storageKey: 'vehicle-store', kind: 'list', itemsField: 'vehicles', rehydrate: rehydrator(useVehicleStore) },
  { storageKey: 'worker-store', kind: 'list', itemsField: 'workers', rehydrate: rehydrator(useWorkerStore) },
  { storageKey: 'work-order-store', kind: 'list', itemsField: 'workOrders', rehydrate: rehydrator(useWorkOrderStore) },
  { storageKey: 'inventory-store', kind: 'list', itemsField: 'products', rehydrate: rehydrator(useInventoryStore) },
  // Lots and movements are append-only as of the stock ledger (src/lib/stockLedger.ts) —
  // never edited or deleted once created — so 'append' is the correct sync kind, not 'list'.
  { storageKey: 'stock-lot-store', kind: 'append', itemsField: 'stockLots', rehydrate: rehydrator(useStockLotStore) },
  { storageKey: 'stock-movement-store', kind: 'append', itemsField: 'movements', rehydrate: rehydrator(useStockMovementStore) },
  { storageKey: 'supplier-store', kind: 'list', itemsField: 'suppliers', rehydrate: rehydrator(useSupplierStore) },
  { storageKey: 'expense-store', kind: 'list', itemsField: 'expenses', rehydrate: rehydrator(useExpenseStore) },
  // expense-store persists a second, independent field — see the `field` note in ./types.ts.
  { storageKey: 'expense-store', kind: 'singleton', itemsField: 'categories', rehydrate: rehydrator(useExpenseStore) },
  { storageKey: 'settings-store', kind: 'singleton', itemsField: 'settings', rehydrate: rehydrator(useSettingsStore) },
  { storageKey: 'service-item-type-store', kind: 'list', itemsField: 'serviceItemTypes', rehydrate: rehydrator(useServiceItemTypeStore) },
  { storageKey: 'product-category-store', kind: 'list', itemsField: 'categories', rehydrate: rehydrator(useProductCategoryStore) },
  { storageKey: 'service-catalog-store', kind: 'list', itemsField: 'services', rehydrate: rehydrator(useServiceCatalogStore) },
  { storageKey: 'schedule-rule-store', kind: 'list', itemsField: 'scheduleRules', rehydrate: rehydrator(useScheduleRuleStore) },
  { storageKey: 'service-event-store', kind: 'list', itemsField: 'serviceEvents', rehydrate: rehydrator(useServiceEventStore) },
  { storageKey: 'language-store', kind: 'singleton', itemsField: 'language', rehydrate: rehydrator(useLanguageStore) },
  { storageKey: 'appointment-storage', kind: 'list', itemsField: 'appointments', rehydrate: rehydrator(useAppointmentStore) },
  { storageKey: 'bay-storage', kind: 'list', itemsField: 'bays', rehydrate: rehydrator(useBayStore) },
]
