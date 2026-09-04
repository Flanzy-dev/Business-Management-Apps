// Backup/restore/clear-all for every persisted store. The registry itself —
// PERSISTED_STORES, plus the device-local/shop-data classification it's built
// from — lives in src/lib/storageKeys.ts (zero imports, so it can also be
// shared with the sync engine and the Node-only sync server without dragging
// storageAdapter or zustand into either). Import it from there, not from here:
// this file used to re-export it as a compatibility shim, but every caller has
// since moved to the real home and the shim was dead.
//
// Every zustand store created with `persist` MUST be registered in
// PERSISTED_STORES — backup, restore, and clear-all below all iterate it, so
// an unregistered store would silently be missing from user backups. That has
// actually happened (appointment/bay/product-category stores were persisted but
// unregistered, and silently absent from every backup), which is why storage
// arrives through a parameter here: the same createX(deps) + bound-default
// shape src/lib/ops/inventoryOps.ts uses, so this — the one module that can
// destroy a shop's data — is reachable from a test.

import { storageAdapter, type StorageAdapter } from './storageAdapter'
import { PERSISTED_STORES, DEVICE_LOCAL_KEYS } from './storageKeys'

export function createPersistence(storage: StorageAdapter) {
  /** Snapshot of all persisted stores, keyed by backup field name. */
  function collectBackup(): Record<string, string | null> {
    const backup: Record<string, string | null> = {}
    for (const { storageKey, backupField } of PERSISTED_STORES) {
      backup[backupField] = storage.getItem(storageKey)
    }
    return backup
  }

  /**
   * Write a parsed backup file's fields back into storage. Unknown fields
   * are ignored; missing fields leave the current data untouched. Returns the
   * number of stores restored. Caller reloads the page afterwards so the
   * zustand stores rehydrate.
   */
  function applyBackup(data: Record<string, unknown>): number {
    let restored = 0
    for (const { storageKey, backupField } of PERSISTED_STORES) {
      const value = data[backupField]
      if (typeof value === 'string') {
        storage.setItem(storageKey, value)
        restored++
      }
    }
    return restored
  }

  /**
   * Remove all registered stores' data. Caller reloads the page afterwards.
   *
   * Each removeItem now flows through storageAdapter's removeItem listener
   * channel (see storageAdapter.ts's onStorageRemoveItem), so the sync
   * tracker sees this as a real change and queues delete ops for every row
   * that existed — before that channel existed, clearAllData was invisible
   * to sync entirely: nothing told any other device this had happened.
   *
   * Also resets this device's own sync cursor, so its next sync cold-joins
   * instead of just catching up from where it left off — catching up would
   * be correct too (this device's own delete ops already cover its own
   * data), but a cold join is the more defensive choice: it re-derives this
   * device's state from whatever the host currently has rather than trusting
   * that every queued op actually lands.
   */
  function clearAllData(): void {
    for (const { storageKey } of PERSISTED_STORES) {
      storage.removeItem(storageKey)
    }
    storage.removeItem(DEVICE_LOCAL_KEYS.syncCursor)
  }

  return { collectBackup, applyBackup, clearAllData }
}

// The one real instance the running app uses. Every named export below is a
// thin pass-through onto it, so no page import had to change.
const defaultPersistence = createPersistence(storageAdapter)

export const collectBackup = defaultPersistence.collectBackup
export const applyBackup = defaultPersistence.applyBackup
export const clearAllData = defaultPersistence.clearAllData
