import { create } from 'zustand'
import { INITIAL_UPDATE_STATE, type UpdateState } from '../lib/update/updateState'

// Live-only status of the auto-updater (electron/main.ts's "Auto-update"
// section, bridged through src/lib/update/updateBridge.ts) — deliberately
// NOT persisted, same rationale as src/store/syncStatusStore.ts: this
// describes what THIS session's main process is doing right now, not shop
// data, and should always start fresh on launch rather than remembering a
// stale status from last time the app was open.
//
// `hostVersion` is a second, independent live value: the shop's host's
// reported app version (src/lib/update/hostVersionWatch.ts, fed by
// GET /api/info and by SyncFollowerSetup's "Test connection"), used only
// for the version-skew warning in SyncCard.tsx's follower block. It has
// nothing to do with whether THIS device has an update available — a
// browser tab, which can never auto-update itself, still wants to know if
// it's running stale code relative to its host.
export interface UpdateStoreState {
  update: UpdateState
  hostVersion: string | null
  /** "Later" on the restart-ready banner (UpdateReadyBanner.tsx) hides it
   *  until the next app launch. In-memory only, never persisted: a shop
   *  that snoozes today should be asked again tomorrow, not have the
   *  banner suppressed forever by a stray localStorage/SQLite row. */
  bannerSnoozed: boolean
  setUpdate: (state: UpdateState) => void
  setHostVersion: (version: string | null) => void
  snoozeBanner: () => void
}

export const useUpdateStore = create<UpdateStoreState>((set) => ({
  update: INITIAL_UPDATE_STATE,
  hostVersion: null,
  bannerSnoozed: false,
  setUpdate: (update) => set({ update }),
  setHostVersion: (hostVersion) => set({ hostVersion }),
  snoozeBanner: () => set({ bannerSnoozed: true }),
}))
