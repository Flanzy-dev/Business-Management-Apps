// The one seam between "the app persists data" and "where that data lives".
// Every persisted zustand store passes `storage: createJSONStorage(getStorageAdapter)`
// (see src/store/*.ts), and src/lib/persistence.ts reads/writes through the
// `storageAdapter` binding for backup/restore/clear — no store or page
// touches `localStorage` (or Electron) directly.
//
// Two implementations exist: `localStorageAdapter` (plain browser storage,
// used by `npm run dev` and Vitest) and `electronSqliteAdapter` below (real
// SQLite via the Electron main process, used by the packaged/dev Electron
// shell). `storageAdapter` picks whichever applies at runtime.
//
// Shape matches zustand's `StateStorage` exactly, so it drops straight into
// `createJSONStorage`.
export interface StorageAdapter {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export const localStorageAdapter: StorageAdapter = {
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
  removeItem: (key) => localStorage.removeItem(key),
}

// Real SQLite storage, bridged synchronously to the Electron main process
// (electron/preload.ts -> electron/main.ts, sql.js-backed). Only present
// inside the packaged/dev Electron shell — `npm run dev` (plain Vite in a
// browser tab) and the Vitest test runner never see `window.electronAPI`,
// so they fall through to localStorageAdapter below untouched.
declare global {
  interface Window {
    electronAPI?: {
      getAppPath: () => Promise<string>
      openExternal: (url: string) => Promise<void>
      /** This machine's LAN IPv4 address, or null if none was found — see
       *  electron/main.ts's 'get-lan-address' handler. Only meaningful from
       *  the desktop app's own window (loaded via file://); a device that
       *  loaded the app over http already knows its address as
       *  window.location.hostname. */
      getLanAddress: () => Promise<string | null>
      db: {
        getItem(key: string): string | null
        setItem(key: string, value: string): void
        removeItem(key: string): void
      }
    }
  }
}

const electronSqliteAdapter: StorageAdapter | null =
  typeof window !== 'undefined' && window.electronAPI?.db
    ? {
        getItem: (key) => window.electronAPI!.db.getItem(key),
        setItem: (key, value) => window.electronAPI!.db.setItem(key, value),
        removeItem: (key) => window.electronAPI!.db.removeItem(key),
      }
    : null

const rawAdapter: StorageAdapter = electronSqliteAdapter ?? localStorageAdapter

type SetItemListener = (key: string, prevValue: string | null, nextValue: string) => void
const setItemListeners: SetItemListener[] = []

/**
 * Subscribe to every setItem this adapter performs, seeing the value that
 * was there before alongside the value being written. This is the multi-
 * device sync engine's only hook into "something changed" (src/lib/sync/
 * tracker.ts) — no individual store needs to know sync exists, because this
 * is already the one seam every store's persistence goes through (see the
 * file header above). Returns an unsubscribe function.
 */
export function onStorageSetItem(listener: SetItemListener): () => void {
  setItemListeners.push(listener)
  return () => {
    const i = setItemListeners.indexOf(listener)
    if (i >= 0) setItemListeners.splice(i, 1)
  }
}

export const storageAdapter: StorageAdapter = {
  getItem: (key) => rawAdapter.getItem(key),
  setItem: (key, value) => {
    const prevValue = rawAdapter.getItem(key)
    rawAdapter.setItem(key, value)
    for (const listener of setItemListeners) listener(key, prevValue, value)
  },
  removeItem: (key) => rawAdapter.removeItem(key),
}

/**
 * Passed as `createJSONStorage(getStorageAdapter)` by every store. Touches
 * `localStorage` eagerly so that in an environment where it doesn't exist
 * (the Node test runner runs stores with no DOM) the ReferenceError surfaces
 * here — inside `createJSONStorage`'s own try/catch — and zustand falls back
 * to its built-in "storage unavailable" no-op instead of crashing deeper
 * inside a getItem/setItem call.
 */
export function getStorageAdapter(): StorageAdapter {
  void localStorage
  return storageAdapter
}
