// Stable per-install identifier. Every StockMovement is stamped with the
// device that created it (see src/store/stockMovementStore.ts) and multi-
// device sync (src/lib/sync/) uses it to tell "my unsynced ops" apart from
// "ops I already pulled".
//
// Generated once and cached in whichever storage this device uses (see
// storageAdapter.ts), so it survives reloads but is never shared between
// devices — that's what makes it a *device* id and not an install-wide one.
// See src/lib/storageKeys.ts's DEVICE_LOCAL_KEYS for why this key in
// particular must never be backed up, restored, or synced: a device that
// adopted another device's id would misattribute every StockMovement it
// writes afterward.
import { storageAdapter } from './storageAdapter'
import { newId } from './id'
import { DEVICE_LOCAL_KEYS } from './storageKeys'

let cached: string | null = null

export function getDeviceId(): string {
  if (cached) return cached
  const existing = storageAdapter.getItem(DEVICE_LOCAL_KEYS.deviceId)
  if (existing) {
    cached = existing
    return existing
  }
  const id = newId()
  storageAdapter.setItem(DEVICE_LOCAL_KEYS.deviceId, id)
  cached = id
  return id
}
