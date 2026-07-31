import { create } from 'zustand'

// Live-only status of the sync engine (src/lib/sync/engine.ts) — deliberately
// NOT persisted: it describes this session's connection, not shop data, and
// should always start fresh (e.g. 'idle') on launch rather than remembering
// yesterday's "offline". Read by the sidebar sync indicator and Settings
// (Phase 4).
export type SyncPhase = 'idle' | 'syncing' | 'synced' | 'offline' | 'error' | 'unauthorized'

interface SyncStatusState {
  phase: SyncPhase
  pendingCount: number
  lastSyncedAt: string | null
  lastError: string | null
}

interface SyncStatusStore extends SyncStatusState {
  setStatus: (data: Partial<SyncStatusState>) => void
}

export const useSyncStatusStore = create<SyncStatusStore>((set) => ({
  phase: 'idle',
  pendingCount: 0,
  lastSyncedAt: null,
  lastError: null,
  setStatus: (data) => set(data),
}))
