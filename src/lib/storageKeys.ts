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
  /** src/lib/sync/engine.ts — ops this device received but couldn't apply
   *  (a malformed payload) instead of retrying forever. Purely diagnostic,
   *  and per-device: two devices quarantining the same poison op is
   *  expected, not something to reconcile. */
  syncQuarantine: 'sync-quarantine',
  /** src/lib/auth/storedSession.ts — which account is signed in on THIS
   *  device, as JSON: { v, mode: 'admin' | 'worker', username }. Read that
   *  file's header before changing anything here.
   *
   *  It USED to hold the bare string 'worker' and never 'admin', because
   *  admin sessions were memory-only by design. That is reversed: a session
   *  now survives a restart until someone picks Switch account. The bare
   *  'worker' string still parses, so devices upgrading from that format
   *  are not signed out.
   *
   *  This is not a credential — it is a memory that a credential was
   *  checked, and is forgeable by anyone holding the database file. What
   *  still constrains it: the stored username must name an account present
   *  in the synced shop data, so renaming the admin account signs out every
   *  device that resumed under the old name.
   *
   *  Must never sync (one device's session would flip every other device's)
   *  and never be backed up (restoring onto a fresh device would silently
   *  skip the login screen). */
  authMode: 'auth-mode',
  /** src/lib/auth/loginThrottle.ts — this device's own admin-password
   *  attempt counter and lockout expiry. Per-device on purpose: one
   *  device's failed attempts must never lock out a different device's
   *  legitimate admin. */
  authLockout: 'auth-lockout',
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
  { storageKey: 'security-store', backupField: 'security' },
  { storageKey: 'activity-log-store', backupField: 'activityLog' },
  { storageKey: 'service-item-type-store', backupField: 'serviceItemTypes' },
  { storageKey: 'product-category-store', backupField: 'productCategories' },
  { storageKey: 'service-catalog-store', backupField: 'serviceCatalog' },
  { storageKey: 'schedule-rule-store', backupField: 'scheduleRules' },
  { storageKey: 'service-event-store', backupField: 'serviceEvents' },
  { storageKey: 'reminder-follow-up-store', backupField: 'reminderFollowUps' },
  { storageKey: 'language-store', backupField: 'language' },
  { storageKey: 'appointment-storage', backupField: 'appointments' },
  { storageKey: 'bay-storage', backupField: 'bays' },
] as const

export type StoreKey = (typeof PERSISTED_STORES)[number]['storageKey']

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
