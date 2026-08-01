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
  'service-item-type-store': [{ kind: 'list', itemsField: 'serviceItemTypes' }],
  'product-category-store': [{ kind: 'list', itemsField: 'categories' }],
  'service-catalog-store': [{ kind: 'list', itemsField: 'services' }],
  'schedule-rule-store': [{ kind: 'list', itemsField: 'scheduleRules' }],
  'service-event-store': [{ kind: 'list', itemsField: 'serviceEvents' }],
  'language-store': [{ kind: 'singleton', itemsField: 'language' }],
  'appointment-storage': [{ kind: 'list', itemsField: 'appointments' }],
  'bay-storage': [{ kind: 'list', itemsField: 'bays' }],
}

export interface SyncUnitSpec extends SyncFieldSpec {
  storageKey: StoreKey
}

/** Every {storageKey, kind, itemsField} sync unit, flattened from
 *  SYNC_FIELDS in PERSISTED_STORES order — the store-instance-free half of
 *  what used to be storeRegistry.ts's SYNC_UNITS. Order only affects
 *  rehydration sequencing in storeRegistry.ts, which is order-independent. */
export const SYNC_UNIT_SPECS: SyncUnitSpec[] = PERSISTED_STORES.flatMap(({ storageKey }) =>
  SYNC_FIELDS[storageKey].map((spec) => ({ storageKey, ...spec }))
)
