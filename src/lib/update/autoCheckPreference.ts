// Whether THIS device checks GitHub for updates automatically — read
// directly by electron/main.ts's runUpdateCheck() via db.getItem (the same
// one-source-of-truth trick server/shopToken.ts's readShopToken uses), and
// read/written here by the renderer's Settings > Updates toggle
// (UpdateCard.tsx). Device-local, not shop data — see
// src/lib/storageKeys.ts's DEVICE_LOCAL_KEYS.autoUpdate doc for why syncing
// this would be wrong.
import { storageAdapter } from '../storageAdapter'
import { DEVICE_LOCAL_KEYS } from '../storageKeys'

/** Absent means on — an opt-OUT, not an opt-in, so a shop that never opens
 *  this toggle still gets checked (see the plan's decision: an
 *  updater that's off by default is an updater that never runs). */
export function isAutoCheckEnabled(): boolean {
  return storageAdapter.getItem(DEVICE_LOCAL_KEYS.autoUpdate) !== 'off'
}

export function setAutoCheckEnabled(enabled: boolean): void {
  storageAdapter.setItem(DEVICE_LOCAL_KEYS.autoUpdate, enabled ? 'on' : 'off')
}
