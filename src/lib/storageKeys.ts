// The positive classification of every key that lives in the shared
// storageAdapter keyspace (see src/lib/storageAdapter.ts) — either shop data
// (persisted, backed up, synced) or device-local (this install's own
// identity/bookkeeping, never any of those things).
//
// Before this file, "device-local" meant only "absent from PERSISTED_STORES
// and SYNC_UNITS" — an absence, not a declaration. That was invisible to any
// code that doesn't consult those two lists, which is exactly what
// server/db.ts's snapshot() and src/lib/sync/engine.ts's joinCold() are: they
// read/write the whole keyspace with no registry in sight. A key classified
// only by omission can't be checked against there — see
// src/lib/sync/snapshotPlan.ts for where that mattered.
//
// Deliberately zero imports: the renderer, every test file, and (via
// tsconfig.server.json's include list) the Node-only sync server all need to
// classify keys without dragging in storageAdapter, the DOM, or zustand.

/**
 * Keys that are this device's own identity or sync bookkeeping — never shop
 * data, never backed up, never synced. Named individually rather than by a
 * shared prefix because there isn't one: `device-id` predates the `sync-`
 * prefix the other three happen to share, so a prefix rule could never have
 * covered it. See docs/DATA_MODEL.md's "Sync-internal keys" section for why
 * each one specifically must stay out of the shop-data machinery.
 */
export const DEVICE_LOCAL_KEYS = {
  /** src/lib/deviceId.ts — this install's identity. Stamped onto every
   *  StockMovement; a restored backup or an adopted snapshot must never
   *  overwrite it, or op attribution silently breaks. */
  deviceId: 'device-id',
  /** src/lib/sync/hostConfig.ts — which server this device follows. If this
   *  synced, the main device would push "I am the main device" to every
   *  follower and point them all at themselves. */
  syncHost: 'sync-host',
  /** src/lib/sync/outbox.ts — this device's own not-yet-pushed ops. */
  syncOutbox: 'sync-outbox',
  /** src/lib/sync/engine.ts — this device's own replay progress marker. */
  syncCursor: 'sync-cursor',
} as const

export type DeviceLocalKey = (typeof DEVICE_LOCAL_KEYS)[keyof typeof DEVICE_LOCAL_KEYS]

const DEVICE_LOCAL_KEY_SET: ReadonlySet<string> = new Set(Object.values(DEVICE_LOCAL_KEYS))

/**
 * Every store that persists, and how it's named in storage vs. in a backup
 * file. `storageKey` is the zustand persist name (frozen — changing it
 * strands existing user data). `backupField` is the field name inside
 * exported backup JSON files (also frozen, for compatibility with old
 * backups). Moved here from src/lib/persistence.ts, which now re-exports it,
 * so this file can be the one place both backup and sync derive their store
 * list from.
 */
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

export type StoreKey = (typeof PERSISTED_STORES)[number]['storageKey']
export type BackupField = (typeof PERSISTED_STORES)[number]['backupField']

const STORE_KEY_SET: ReadonlySet<string> = new Set(PERSISTED_STORES.map((s) => s.storageKey))

export function isShopDataKey(key: string): key is StoreKey {
  return STORE_KEY_SET.has(key)
}

export function isDeviceLocalKey(key: string): key is DeviceLocalKey {
  return DEVICE_LOCAL_KEY_SET.has(key)
}

export type KeyClass = 'shop-data' | 'device-local' | 'unknown'

/** Classifies any key that might show up in the shared storageAdapter
 *  keyspace. 'unknown' covers anything registered in neither list — treated
 *  the same as device-local by every consumer that matters (never synced,
 *  never backed up), but named separately so a genuinely unrecognized key
 *  doesn't get silently lumped in with the four that are deliberately
 *  device-local. */
export function classifyKey(key: string): KeyClass {
  if (isShopDataKey(key)) return 'shop-data'
  if (isDeviceLocalKey(key)) return 'device-local'
  return 'unknown'
}
