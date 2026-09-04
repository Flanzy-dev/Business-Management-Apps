import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { STORE_VERSIONS } from '../sync/syncFields'
import { PERSISTED_STORES, type StoreKey } from '../storageKeys'

// STORE_VERSIONS (syncFields.ts) is a second, hand-maintained record of each
// store's `persist(..., { version })` — it has to be, because it's shared
// with the Node-only standalone sync server (server/db.ts), which cannot
// import real zustand store modules the way a live-instance test would.
// That means nothing stops the two from drifting apart the moment someone
// bumps a store's real `version` and forgets this table — exactly the
// scenario that corrupted work-order-store's odometer fields on cold sync
// (see STORE_VERSIONS's doc comment). This test is the guard.
//
// It reads each store's declared version straight out of its source file
// rather than off a live zustand instance's `persist.getOptions()`: this
// project's vitest config runs in a plain Node environment (no DOM), and
// zustand's persist middleware only attaches `.persist` to the store when
// its `getStorage()` probe succeeds at creation time — see
// node_modules/zustand/middleware.js's `if (!storage) { return config(...) }`
// early-return, which skips the `api.persist = {...}` assignment entirely.
// getStorageAdapter() (../storageAdapter.ts) deliberately touches
// `localStorage` eagerly so that probe throws in Node, meaning every store
// created in this test suite has `.persist === undefined` — there is no live
// value to read here without adding a DOM environment. Parsing the source
// is what a human reviewer would do to check this by hand, and is exactly
// as effective a regression guard: it still fails the moment `version:`
// changes in a store file without this table being updated to match.
const STORE_FILES: Record<StoreKey, string> = {
  'customer-store': 'customerStore.ts',
  'company-store': 'companyStore.ts',
  'vehicle-store': 'vehicleStore.ts',
  'worker-store': 'workerStore.ts',
  'work-order-store': 'workOrderStore.ts',
  'inventory-store': 'inventoryStore.ts',
  'stock-lot-store': 'stockLotStore.ts',
  'stock-movement-store': 'stockMovementStore.ts',
  'supplier-store': 'supplierStore.ts',
  'expense-store': 'expenseStore.ts',
  'settings-store': 'settingsStore.ts',
  'security-store': 'securityStore.ts',
  'activity-log-store': 'activityLogStore.ts',
  'service-item-type-store': 'serviceItemTypeStore.ts',
  'product-category-store': 'productCategoryStore.ts',
  'service-catalog-store': 'serviceCatalogStore.ts',
  'schedule-rule-store': 'scheduleRuleStore.ts',
  'service-event-store': 'serviceEventStore.ts',
  'reminder-follow-up-store': 'reminderFollowUpStore.ts',
  'language-store': 'languageStore.ts',
  'appointment-storage': 'appointmentStore.ts',
  'bay-storage': 'bayStore.ts',
}

const STORE_DIR = path.join(__dirname, '../../store')

/** The `version:` a store's own `persist(..., { ... })` options object
 *  declares, or 0 (zustand's own default) when the key is absent — mirrors
 *  zustand's `_extends({ version: 0, ... }, baseOptions)` default exactly. */
function declaredVersion(storeKey: StoreKey): number {
  const filePath = path.join(STORE_DIR, STORE_FILES[storeKey])
  const source = fs.readFileSync(filePath, 'utf8')
  const match = source.match(/\bversion:\s*(\d+)/)
  return match ? parseInt(match[1], 10) : 0
}

describe("STORE_VERSIONS matches each store file's declared persist version", () => {
  for (const { storageKey } of PERSISTED_STORES) {
    it(storageKey, () => {
      expect(STORE_VERSIONS[storageKey]).toBe(declaredVersion(storageKey))
    })
  }
})
