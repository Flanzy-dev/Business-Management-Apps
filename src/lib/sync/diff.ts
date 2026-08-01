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

  if (kind === 'singleton') {
    if (next === undefined) return []
    if (JSON.stringify(prev) === JSON.stringify(next)) return []
    return [{ device, entity, field: itemsField, entityId: entity, kind: 'upsert', payload: JSON.stringify(next), ts }]
  }

  const prevRows = Array.isArray(prev) ? (prev as Row[]) : []
  const nextRows = Array.isArray(next) ? (next as Row[]) : []
  const prevById = new Map(prevRows.map((r) => [r.id, r]))
  const nextById = new Map(nextRows.map((r) => [r.id, r]))

  const ops: Omit<SyncOp, 'id'>[] = []

  for (const [id, row] of nextById) {
    const before = prevById.get(id)
    if (!before || JSON.stringify(before) !== JSON.stringify(row)) {
      ops.push({
        device,
        entity,
        field: itemsField,
        entityId: id,
        kind: kind === 'append' ? 'append' : 'upsert',
        payload: JSON.stringify(row),
        ts,
      })
    }
  }

  if (kind === 'list') {
    for (const id of prevById.keys()) {
      if (!nextById.has(id)) {
        ops.push({ device, entity, field: itemsField, entityId: id, kind: 'delete', payload: '', ts })
      }
    }
  }

  return ops
}
