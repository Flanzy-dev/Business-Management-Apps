// Which persisted fields of each store sync, and how (see SyncKind in
// ./types.ts). Store-free and Node-safe — no zustand imports — so it can be
// shared with the sync server (server/db.ts's future oplog-to-KV
// materialization) without dragging React/zustand into a plain Node process.
// The rehydration wiring that DOES need real store instances lives in
// ./storeRegistry.ts, which builds SYNC_UNITS from this file.
//
// Named syncFields.ts, not units.ts: src/lib/units.ts already exists (the
// km/L metric-unit helper) and means something entirely different.
import { PERSISTED_STORES, type StoreKey } from '../storageKeys'
import type { SyncKind } from './types'

export interface SyncFieldSpec {
  kind: SyncKind
  itemsField: string
}

/**
 * Record<StoreKey, …> on an object literal is checked exhaustively in BOTH
 * directions by the compiler: a store added to PERSISTED_STORES without an
 * entry here is a missing-property error (TS2739); an entry for a key that
 * isn't a registered store is an excess-property error (TS2353). Neither
 * "forgot to wire a new store into sync" nor "sync metadata for a store that
 * doesn't exist" can compile. Zero runtime cost — PERSISTED_STORES' `as
 * const` is what makes StoreKey a literal union instead of `string`.
 *
 * A store with nothing to sync would be declared as an explicit `[]` rather
 * than omitted — every StoreKey below has at least one spec today, and
 * src/lib/__tests__/syncFields.test.ts asserts that stays true, so an empty
 * array reads as "someone forgot" rather than a silent, valid opt-out.
 */
export const SYNC_FIELDS: Record<StoreKey, readonly SyncFieldSpec[]> = {
  'customer-store': [{ kind: 'list', itemsField: 'customers' }],
  'company-store': [{ kind: 'list', itemsField: 'companies' }],
  'vehicle-store': [{ kind: 'list', itemsField: 'vehicles' }],
  'worker-store': [{ kind: 'list', itemsField: 'workers' }],
  'work-order-store': [{ kind: 'list', itemsField: 'workOrders' }],
  'inventory-store': [{ kind: 'list', itemsField: 'products' }],
  // Lots and movements are append-only as of the stock ledger
  // (src/lib/stockLedger.ts) — never edited or deleted once created — so
  // 'append' is the correct sync kind, not 'list'.
  'stock-lot-store': [{ kind: 'append', itemsField: 'stockLots' }],
  'stock-movement-store': [{ kind: 'append', itemsField: 'movements' }],
  'supplier-store': [{ kind: 'list', itemsField: 'suppliers' }],
  // expense-store persists two independent fields — the one 1:N case. `field`
  // on a SyncOp (see ./types.ts) is what keeps their ops apart downstream.
  'expense-store': [
    { kind: 'list', itemsField: 'expenses' },
    { kind: 'singleton', itemsField: 'categories' },
  ],
  'settings-store': [{ kind: 'singleton', itemsField: 'settings' }],
  'security-store': [{ kind: 'singleton', itemsField: 'security' }],
  // Append-only, same reasoning as the stock ledger stores above — entries
  // are never edited or deleted once written.
  'activity-log-store': [{ kind: 'append', itemsField: 'entries' }],
  'service-item-type-store': [{ kind: 'list', itemsField: 'serviceItemTypes' }],
  'product-category-store': [{ kind: 'list', itemsField: 'categories' }],
  'service-catalog-store': [{ kind: 'list', itemsField: 'services' }],
  'schedule-rule-store': [{ kind: 'list', itemsField: 'scheduleRules' }],
  'service-event-store': [{ kind: 'list', itemsField: 'serviceEvents' }],
  'reminder-follow-up-store': [{ kind: 'list', itemsField: 'followUps' }],
  'language-store': [{ kind: 'singleton', itemsField: 'language' }],
  'appointment-storage': [{ kind: 'list', itemsField: 'appointments' }],
  'bay-storage': [{ kind: 'list', itemsField: 'bays' }],
}

/**
 * Each store's zustand `persist` version — the same number that store's own
 * `persist(..., { version })` option declares in src/store/*.ts (0 for every
 * store that doesn't set one explicitly, which is zustand's own default).
 *
 * applyOpsToBlob (./merge.ts) needs this whenever it has to fabricate a
 * brand-new envelope for a store this device has no local blob for yet —
 * e.g. a tablet paired before the shop's first work order exists, or the
 * standalone Ubuntu server materializing its oplog into key_value_store for
 * the first time (server/db.ts). Stamping that fresh envelope with `version:
 * 0` used to make zustand's persist think a downgrade-then-upgrade migration
 * was due on the very next rehydrate, and run it on rows that were already
 * in the current shape — see work-order-store's v1->v2 migration, which
 * strips a field (`mileageIn`) current rows never had and nulls
 * `odometerAtArrival`/`odometerAtService` in its place. Worse, that
 * migration's own write then gets diffed and pushed to every other device
 * as upserts, so the corruption doesn't stay local.
 *
 * Record<StoreKey, …> gets this the same compile-time completeness
 * SYNC_FIELDS above already has. A runtime test in
 * src/lib/__tests__/storeVersions.test.ts additionally asserts every entry
 * here matches the real store's declared `persist` version, so a future
 * `version:` bump that forgets to update this table fails CI instead of
 * corrupting data on the next cold sync.
 */
export const STORE_VERSIONS: Record<StoreKey, number> = {
  'customer-store': 0,
  'company-store': 0,
  'vehicle-store': 0,
  'worker-store': 0,
  'work-order-store': 2,
  'inventory-store': 1,
  'stock-lot-store': 0,
  'stock-movement-store': 0,
  'supplier-store': 0,
  'expense-store': 0,
  'settings-store': 0,
  'security-store': 0,
  'activity-log-store': 0,
  'service-item-type-store': 0,
  'product-category-store': 5,
  'service-catalog-store': 0,
  'schedule-rule-store': 1,
  'service-event-store': 0,
  'reminder-follow-up-store': 0,
  'language-store': 0,
  'appointment-storage': 0,
  'bay-storage': 0,
}

export interface SyncUnitSpec extends SyncFieldSpec {
  storageKey: StoreKey
  version: number
}

/** Every {storageKey, kind, itemsField, version} sync unit, flattened from
 *  SYNC_FIELDS in PERSISTED_STORES order — the store-instance-free half of
 *  what used to be storeRegistry.ts's SYNC_UNITS. Order only affects
 *  rehydration sequencing in storeRegistry.ts, which is order-independent. */
export const SYNC_UNIT_SPECS: SyncUnitSpec[] = PERSISTED_STORES.flatMap(({ storageKey }) =>
  SYNC_FIELDS[storageKey].map((spec) => ({ storageKey, version: STORE_VERSIONS[storageKey], ...spec }))
)
