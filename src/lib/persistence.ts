// Single source of truth for what this app persists (currently in
// localStorage, via storageAdapter — see src/lib/storageAdapter.ts).
// Every zustand store created with `persist` MUST be registered here —
// backup, restore, and clear-all in Settings all iterate this list, so an
// unregistered store would silently be missing from user backups.
//
// `storageKey` is the zustand persist name (frozen — changing it strands
// existing user data). `backupField` is the field name inside exported
// backup JSON files (also frozen, for compatibility with old backups).

import { storageAdapter } from './storageAdapter'

export const PERSISTED_STORES = [
  { storageKey: 'customer-store', backupField: 'customers' },
  { storageKey: 'company-store', backupField: 'companies' },
  { storageKey: 'vehicle-store', backupField: 'vehicles' },
  { storageKey: 'worker-store', backupField: 'workers' },
  { storageKey: 'work-order-store', backupField: 'workOrders' },
  { storageKey: 'inventory-store', backupField: 'inventory' },
  { storageKey: 'stock-lot-store', backupField: 'stockLots' },
  { storageKey: 'stock-movement-store', backupField: 'stockMovements' },
  { storageKey: 'supplier-store', backupField: 'suppliers' },
  { storageKey: 'expense-store', backupField: 'expenses' },
  { storageKey: 'settings-store', backupField: 'settings' },
  { storageKey: 'service-item-type-store', backupField: 'serviceItemTypes' },
  { storageKey: 'product-category-store', backupField: 'productCategories' },
  { storageKey: 'service-catalog-store', backupField: 'serviceCatalog' },
  { storageKey: 'schedule-rule-store', backupField: 'scheduleRules' },
  { storageKey: 'service-event-store', backupField: 'serviceEvents' },
  { storageKey: 'language-store', backupField: 'language' },
  { storageKey: 'appointment-storage', backupField: 'appointments' },
  { storageKey: 'bay-storage', backupField: 'bays' },
] as const

/** Snapshot of all persisted stores, keyed by backup field name. */
export function collectBackup(): Record<string, string | null> {
  const backup: Record<string, string | null> = {}
  for (const { storageKey, backupField } of PERSISTED_STORES) {
    backup[backupField] = storageAdapter.getItem(storageKey)
  }
  return backup
}

/**
 * Write a parsed backup file's fields back into storage. Unknown fields
 * are ignored; missing fields leave the current data untouched. Returns the
 * number of stores restored. Caller reloads the page afterwards so the
 * zustand stores rehydrate.
 */
export function applyBackup(data: Record<string, unknown>): number {
  let restored = 0
  for (const { storageKey, backupField } of PERSISTED_STORES) {
    const value = data[backupField]
    if (typeof value === 'string') {
      storageAdapter.setItem(storageKey, value)
      restored++
    }
  }
  return restored
}

/** Remove all registered stores' data. Caller reloads the page afterwards. */
export function clearAllData(): void {
  for (const { storageKey } of PERSISTED_STORES) {
    storageAdapter.removeItem(storageKey)
  }
}
