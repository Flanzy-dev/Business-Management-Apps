// Stable per-install identifier. Every StockMovement is stamped with the
// device that created it (see src/store/stockMovementStore.ts) — not because
// anything reads it yet, but because adding it after the fact would mean a
// schema migration over every historical movement instead of an empty column.
//
// Generated once and cached in whichever storage this device uses (see
// storageAdapter.ts), so it survives reloads but is never shared between
// devices — that's what makes it a *device* id and not an install-wide one.
import { storageAdapter } from './storageAdapter'
import { newId } from './id'

const DEVICE_ID_KEY = 'device-id'

let cached: string | null = null

export function getDeviceId(): string {
  if (cached) return cached
  const existing = storageAdapter.getItem(DEVICE_ID_KEY)
  if (existing) {
    cached = existing
    return existing
  }
  const id = newId()
  storageAdapter.setItem(DEVICE_ID_KEY, id)
  cached = id
  return id
}
