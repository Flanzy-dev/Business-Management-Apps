// Shared by both deployments — the Electron shop-PC host (electron/main.ts)
// and the standalone Ubuntu host (server/index.ts) — so the /api/info
// handshake can't report a different name depending on who's hosting. Lives
// here rather than in syncServer.ts on purpose: that file deliberately knows
// nothing about what a "settings-store" is, and takes this as an injected
// callback instead.
import type { SyncDatabase } from './db'

/** Reads the shop's display name out of the key_value_store row for
 *  settings-store, for the /api/info handshake a follower device's "Test
 *  connection" uses to confirm it reached the shop it meant to — see
 *  src/pages/Settings.tsx. Not read through the zustand store: the callers run
 *  outside React, in a main/server process with no zustand of its own.
 *
 *  The row holds a zustand-persist envelope whose state nests the settings
 *  object one level down — {"state":{"settings":{"shopName":…}},"version":0},
 *  see src/store/settingsStore.ts and the `itemsField: 'settings'` entry in
 *  src/lib/sync/syncFields.ts. Reading it one level too shallow is what made
 *  every test connection report "Connected to —".
 *
 *  Returns null when there's no name to report; rendering that absence is the
 *  UI's job (Settings.tsx already falls back to an em-dash). */
export function readShopName(db: SyncDatabase): string | null {
  try {
    const raw = db.getItem('settings-store')
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const name = parsed?.state?.settings?.shopName
    return typeof name === 'string' && name.trim() ? name : null
  } catch {
    return null
  }
}
