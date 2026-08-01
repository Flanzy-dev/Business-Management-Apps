// Backup/restore/clear-all for every persisted store. The registry itself —
// PERSISTED_STORES, plus the device-local/shop-data classification it's
// built from — now lives in src/lib/storageKeys.ts (zero imports, so it can
// also be shared with the sync engine and the Node-only sync server without
// dragging storageAdapter or zustand into either). Re-exported here so
// existing importers (src/lib/sync/engine.ts, src/pages/Settings.tsx) don't
// need to change their import path.
//
// Every zustand store created with `persist` MUST be registered in
// PERSISTED_STORES — backup, restore, and clear-all below all iterate it, so
// an unregistered store would silently be missing from user backups.

import { storageAdapter } from './storageAdapter'
import { PERSISTED_STORES } from './storageKeys'

export { PERSISTED_STORES }

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
