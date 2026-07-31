// The single place a local store write becomes an outbox op. Registers once
// as a listener on storageAdapter's setItem seam (src/lib/storageAdapter.ts)
// — no individual store needs to know sync exists. Skips storage keys that
// aren't a registered sync unit (the outbox itself, the device id, the sync
// cursor — anything else riding on the same adapter), and skips writes made
// by the engine applying remote ops back into storage, which must not be
// re-queued as if they were a new local change.
import { onStorageSetItem } from '../storageAdapter'
import { getDeviceId } from '../deviceId'
import { newId } from '../id'
import { diffSyncUnit } from './diff'
import { enqueueOps } from './outbox'
import { SYNC_UNITS } from './storeRegistry'
import type { SyncOp } from './types'

let suppressed = false

/** True while the sync engine is writing a merged remote blob back to
 *  storage — see src/lib/sync/engine.ts's applyRemoteOps. */
export function withTrackingSuppressed<T>(fn: () => T): T {
  const was = suppressed
  suppressed = true
  try {
    return fn()
  } finally {
    suppressed = was
  }
}

type ChangeListener = () => void
const changeListeners: ChangeListener[] = []

/** Notified once per genuine local change queued to the outbox — the signal
 *  src/lib/sync/engine.ts uses to push soon instead of waiting for its next
 *  poll. Never fires for suppressed (remote-applied) writes. */
export function onLocalChange(listener: ChangeListener): () => void {
  changeListeners.push(listener)
  return () => {
    const i = changeListeners.indexOf(listener)
    if (i >= 0) changeListeners.splice(i, 1)
  }
}

let started = false

/** Wire the tracker up. Idempotent, and safe to call before any store has
 *  written anything — see src/lib/sync/engine.ts. */
export function startTracker(): void {
  if (started) return
  started = true

  onStorageSetItem((key, prevValue, nextValue) => {
    if (suppressed) return
    const units = SYNC_UNITS.filter((u) => u.storageKey === key)
    if (units.length === 0) return

    const device = getDeviceId()
    const ts = new Date().toISOString()
    const ops: SyncOp[] = []
    for (const unit of units) {
      for (const op of diffSyncUnit(unit.storageKey, unit.kind, unit.itemsField, prevValue, nextValue, device, ts)) {
        ops.push({ ...op, id: newId() })
      }
    }
    if (ops.length === 0) return
    enqueueOps(ops)
    for (const listener of changeListeners) listener()
  })
}
