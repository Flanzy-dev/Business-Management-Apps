// Applying a batch of incoming ops onto a store's current persisted blob.
// Pure — no storage access; src/lib/sync/engine.ts reads the current blob,
// calls this, and writes the result back through storageAdapter.
//
// Ops are applied strictly in `seq` order — the single total order the LAN
// server assigns (see electron/main.ts). That's the whole merge strategy:
// whichever op reached the server last wins a given row (list/singleton), and
// an append-only row is inserted once and never touched again. Every device
// replays the exact same ops in the exact same order, so every device
// converges on the exact same result — deterministic without needing
// wall-clock comparison or clock-skew handling.
import type { SyncKind, SyncOpWithSeq } from './types'

interface Row {
  id: string
  [key: string]: unknown
}

interface Envelope {
  state?: Record<string, unknown>
  version?: number
  [key: string]: unknown
}

/**
 * Apply an ordered batch of incoming ops for one sync unit onto the current
 * local blob, returning the new blob to write back through storageAdapter.
 * `ops` must already be sorted by seq and already filtered to this unit
 * (same entity + field) — see src/lib/sync/engine.ts.
 */
export function applyOpsToBlob(
  kind: SyncKind,
  itemsField: string,
  currentBlob: string | null,
  ops: SyncOpWithSeq[]
): string {
  const parsed: Envelope = currentBlob ? JSON.parse(currentBlob) : { state: {}, version: 0 }
  const state = parsed.state ?? {}

  if (kind === 'singleton') {
    let value = state[itemsField]
    for (const op of ops) {
      if (op.kind === 'upsert') value = JSON.parse(op.payload)
    }
    return JSON.stringify({ ...parsed, state: { ...state, [itemsField]: value } })
  }

  const existingRows: Row[] = Array.isArray(state[itemsField]) ? (state[itemsField] as Row[]) : []
  const byId = new Map(existingRows.map((r) => [r.id, r]))

  for (const op of ops) {
    if (op.kind === 'delete') {
      byId.delete(op.entityId)
      continue
    }
    if (op.kind === 'append') {
      // Append-only: a row is inserted once and never touched again, so a
      // re-delivered append (a device retrying, or two devices racing to
      // open the same lot) is a no-op rather than clobbering it.
      if (!byId.has(op.entityId)) byId.set(op.entityId, JSON.parse(op.payload))
      continue
    }
    // upsert: last op in seq order wins.
    byId.set(op.entityId, JSON.parse(op.payload))
  }

  return JSON.stringify({ ...parsed, state: { ...state, [itemsField]: [...byId.values()] } })
}
