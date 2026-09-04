// What changed between two persisted blobs, expressed as sync ops. Pure — no
// storage access, no id generation (the caller stamps SyncOp.id; see
// src/lib/sync/tracker.ts) — so this is fully unit-testable on plain strings,
// the same discipline as src/lib/orderLifecycle.ts and inventoryCosting.ts.
import type { SyncKind, SyncOp } from './types'

interface Row {
  id: string
  [key: string]: unknown
}

/** Read one persisted field out of a store's zustand-persist envelope
 *  (`{state: {...}, version}`), or undefined if the blob is missing/unparsable. */
function readField(blob: string | null, itemsField: string): unknown {
  if (!blob) return undefined
  try {
    const parsed = JSON.parse(blob)
    return parsed?.state?.[itemsField]
  } catch {
    return undefined
  }
}

/** The whole-blob case: one upsert op if `next` exists and actually differs
 *  from `prev`, nothing otherwise. */
function diffSingleton(
  entity: string,
  itemsField: string,
  prev: unknown,
  next: unknown,
  device: string,
  ts: string
): Omit<SyncOp, 'id'>[] {
  if (next === undefined) return []
  if (JSON.stringify(prev) === JSON.stringify(next)) return []
  return [{ device, entity, field: itemsField, entityId: entity, kind: 'upsert', payload: JSON.stringify(next), ts }]
}

/**
 * Append-only sync units (stock-lot-store, stock-movement-store,
 * activity-log-store — see SYNC_FIELDS's doc comments in ./syncFields.ts) are
 * defined as never edited once created. Queuing an 'append' op here anyway
 * would be silently ignored by merge.ts's applyOpsToBlob for an id that
 * already exists (`if (!byId.has(...))`) — so the edit would look like it
 * synced, over the network, while every other device permanently kept the
 * original row. Surfacing that here — refusing to queue it, with a loud
 * warning — turns a silent, permanent divergence into something a developer
 * sees the moment it happens, which is the right fix for a row that should
 * never have been mutated at all.
 */
function warnAppendOnlyEdit(entity: string, itemsField: string, id: string): void {
  console.warn(
    `[sync] ${entity}.${itemsField} row ${id} was edited after being appended — append-only rows never sync an edit. ` +
      'This device now permanently disagrees with every other device on this row.'
  )
}

/** New or changed rows since `prevById`, as append/upsert ops. A row edited
 *  after being appended is refused (see warnAppendOnlyEdit), not queued. */
function diffRowUpserts(
  entity: string,
  kind: SyncKind,
  itemsField: string,
  prevById: Map<string, Row>,
  nextById: Map<string, Row>,
  device: string,
  ts: string
): Omit<SyncOp, 'id'>[] {
  const ops: Omit<SyncOp, 'id'>[] = []
  for (const [id, row] of nextById) {
    const before = prevById.get(id)
    if (!before) {
      // Brand new row — the only case 'append' ever legitimately fires.
      ops.push({
        device,
        entity,
        field: itemsField,
        entityId: id,
        kind: kind === 'append' ? 'append' : 'upsert',
        payload: JSON.stringify(row),
        ts,
      })
      continue
    }
    if (JSON.stringify(before) === JSON.stringify(row)) continue

    if (kind === 'append') {
      warnAppendOnlyEdit(entity, itemsField, id)
      continue
    }

    ops.push({ device, entity, field: itemsField, entityId: id, kind: 'upsert', payload: JSON.stringify(row), ts })
  }
  return ops
}

/** Rows in `prevById` gone from `nextById`, as delete ops — a 'list' unit only. */
function diffRowDeletions(
  entity: string,
  itemsField: string,
  prevById: Map<string, Row>,
  nextById: Map<string, Row>,
  device: string,
  ts: string
): Omit<SyncOp, 'id'>[] {
  const ops: Omit<SyncOp, 'id'>[] = []
  for (const id of prevById.keys()) {
    if (!nextById.has(id)) {
      ops.push({ device, entity, field: itemsField, entityId: id, kind: 'delete', payload: '', ts })
    }
  }
  return ops
}

/**
 * What changed in one sync unit (one persisted field of one store) between
 * two blobs, as the ops that would reproduce that change on another device.
 */
export function diffSyncUnit(
  entity: string,
  kind: SyncKind,
  itemsField: string,
  prevBlob: string | null,
  nextBlob: string | null,
  device: string,
  ts: string
): Omit<SyncOp, 'id'>[] {
  const prev = readField(prevBlob, itemsField)
  const next = readField(nextBlob, itemsField)

  if (kind === 'singleton') return diffSingleton(entity, itemsField, prev, next, device, ts)

  const prevRows = Array.isArray(prev) ? (prev as Row[]) : []
  const nextRows = Array.isArray(next) ? (next as Row[]) : []
  const prevById = new Map(prevRows.map((r) => [r.id, r]))
  const nextById = new Map(nextRows.map((r) => [r.id, r]))

  const ops = diffRowUpserts(entity, kind, itemsField, prevById, nextById, device, ts)
  if (kind === 'list') ops.push(...diffRowDeletions(entity, itemsField, prevById, nextById, device, ts))
  return ops
}
