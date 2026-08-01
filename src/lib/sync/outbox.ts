// A persisted queue of not-yet-pushed sync ops. Deliberately NOT a zustand
// store — writing to it must not itself go through the storageAdapter
// setItem hook that src/lib/sync/tracker.ts listens on, or every push would
// re-queue itself as a new outgoing change. Talks to storageAdapter directly
// under its own key, the same way src/lib/deviceId.ts does for the device id
// — the tracker only reacts to keys registered in storeRegistry.ts, so this
// key is invisible to it. See src/lib/storageKeys.ts's DEVICE_LOCAL_KEYS.
import { storageAdapter } from '../storageAdapter'
import { DEVICE_LOCAL_KEYS } from '../storageKeys'
import type { SyncOp } from './types'

const OUTBOX_KEY = DEVICE_LOCAL_KEYS.syncOutbox

export function readOutbox(): SyncOp[] {
  const raw = storageAdapter.getItem(OUTBOX_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeOutbox(ops: SyncOp[]): void {
  storageAdapter.setItem(OUTBOX_KEY, JSON.stringify(ops))
}

export function enqueueOps(ops: SyncOp[]): void {
  if (ops.length === 0) return
  writeOutbox([...readOutbox(), ...ops])
}

/** Drop ops the server has accepted (by id) — called after a successful push. */
export function removeFromOutbox(acceptedIds: Set<string>): void {
  const remaining = readOutbox().filter((op) => !acceptedIds.has(op.id))
  writeOutbox(remaining)
}

/** Discards every pending op outright — used by src/lib/sync/engine.ts's
 *  switchHost(), where pending ops belong to the *old* host's history and
 *  must not be replayed into the new one. Never called by forceResync,
 *  which deliberately keeps the outbox. */
export function clearOutbox(): void {
  writeOutbox([])
}
