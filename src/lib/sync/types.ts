// Wire types for the multi-device sync protocol. Mirrors the `ops` table the
// LAN server (electron/main.ts) keeps — see that file's OPS_TABLE_SQL for the
// server-side shape this has to match field-for-field.

/** How a store's persisted field is diffed and merged — see src/lib/sync/diff.ts and merge.ts. */
export type SyncKind =
  | 'list' // an array of {id}-rows; each row is independently upsertable/deletable
  | 'singleton' // one JSON value for the whole field (settings, language, …)
  | 'append' // an array of {id}-rows that are only ever added, never edited or removed

export type SyncOpKind = 'upsert' | 'delete' | 'append'

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
