// Ops this device received from another device but couldn't apply — a
// malformed payload is the realistic cause (see engine.ts's applyRemoteOps).
// Before this existed, one bad op threw out of applyOpsToBlob, syncNow's
// catch set status 'offline', the cursor never advanced past it (writeCursor
// lived below the throw), and the next pull re-fetched the exact same op and
// threw again — forever. Quarantining instead of retrying means the cursor
// keeps advancing and every *other* op still applies; this is purely a
// record of what got skipped, surfaced in Settings > Multi-device sync, not
// something that resyncs itself — the same op reaching a second device and
// failing there too is expected, not something to reconcile between devices.
//
// Deliberately NOT a zustand store, same reasoning as outbox.ts: writing here
// must not go through the storageAdapter setItem hook src/lib/sync/tracker.ts
// listens on, or quarantining an op would itself get queued as a new
// outgoing change. See src/lib/storageKeys.ts's DEVICE_LOCAL_KEYS.
import { storageAdapter } from '../storageAdapter'
import { DEVICE_LOCAL_KEYS } from '../storageKeys'
import type { SyncOpWithSeq } from './types'

const QUARANTINE_KEY = DEVICE_LOCAL_KEYS.syncQuarantine
// A poison op left forever would grow this without bound on a device that
// stays online — old entries are for "what happened," not an audit log.
const MAX_ENTRIES = 200

export interface QuarantinedOp {
  op: SyncOpWithSeq
  reason: string
  quarantinedAt: string
}

export function readQuarantine(): QuarantinedOp[] {
  const raw = storageAdapter.getItem(QUARANTINE_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeQuarantine(entries: QuarantinedOp[]): void {
  storageAdapter.setItem(QUARANTINE_KEY, JSON.stringify(entries))
}

export function quarantineOp(op: SyncOpWithSeq, reason: string): void {
  const entries = [...readQuarantine(), { op, reason, quarantinedAt: new Date().toISOString() }]
  writeQuarantine(entries.length > MAX_ENTRIES ? entries.slice(entries.length - MAX_ENTRIES) : entries)
}

export function clearQuarantine(): void {
  writeQuarantine([])
}
