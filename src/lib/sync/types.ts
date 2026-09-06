// Wire types for the multi-device sync protocol. Mirrors the `ops` table the
// LAN server (electron/main.ts) keeps — see that file's OPS_TABLE_SQL for the
// server-side shape this has to match field-for-field.

/** How a store's persisted field is diffed and merged — see src/lib/sync/diff.ts and merge.ts. */
export type SyncKind =
  | 'list' // an array of {id}-rows; each row is independently upsertable/deletable
  | 'singleton' // one JSON value for the whole field (settings, language, …)
  | 'append' // an array of {id}-rows that are only ever added, never edited or removed

/**
 * The op kinds, as a value — `SyncOpKind` is derived from it rather than
 * declared alongside it. server/db.ts needs these at *runtime* to validate a
 * body off the wire (it has no compiler to lean on there), and a hand-kept
 * second copy of the list was free to drift: adding a fourth kind here used
 * to compile clean on both halves and then be rejected at runtime as
 * 'malformed op'. Derive both from this and that can't happen.
 */
export const SYNC_OP_KINDS = ['upsert', 'delete', 'append'] as const

export type SyncOpKind = (typeof SYNC_OP_KINDS)[number]

export interface SyncOp {
  /** Client-generated uuid — the idempotency key. A device retrying a push
   *  after a dropped connection must not have it double-applied. */
  id: string
  device: string
  /** The store's storage key (e.g. 'customer-store'). */
  entity: string
  /** Which persisted field of that store this op is for — most stores persist
   *  one array and this is redundant, but e.g. expense-store persists both
   *  `expenses` and `categories`, and without this an op couldn't say which. */
  field: string
  /** The row's own id (list/append), or `entity` again for a singleton field. */
  entityId: string
  kind: SyncOpKind
  /** JSON-encoded row (upsert/append), or empty string (delete). */
  payload: string
  /** Wall-clock ISO timestamp — for display/debugging only. Merge order is
   *  the server-assigned `seq`, not this; see merge.ts. */
  ts: string
}

/** A SyncOp as the server returns it — seq is assigned server-side, the one total order every device agrees on. */
export interface SyncOpWithSeq extends SyncOp {
  seq: number
}

/**
 * SyncOp's own field names, as a value — the `ops` table's non-`seq` columns
 * must match these exactly, and `seq` is server-assigned so it is not one of
 * them. server/db.ts's OPS_TABLE_SQL is the other half of that agreement;
 * src/lib/__tests__/syncWireContract.test.ts holds the two together, because
 * nothing else would notice a column and a field drifting apart.
 */
export const SYNC_OP_FIELDS = [
  'id', 'device', 'entity', 'field', 'entityId', 'kind', 'payload', 'ts',
] as const satisfies readonly (keyof SyncOp)[]
