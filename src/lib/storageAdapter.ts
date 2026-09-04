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

const localStorageAdapter: StorageAdapter = {
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
        setItem(key: string, value: string): { ok: boolean; error?: string } | void
        removeItem(key: string): { ok: boolean; error?: string } | void
      }
      /** Main-process push channel for deferred DB-flush failures. */
      onStorageError?: (cb: (info: { kind: string; message: string }) => void) => void
    }
  }
}

const electronSqliteAdapter: StorageAdapter | null =
  typeof window !== 'undefined' && window.electronAPI?.db
    ? {
        getItem: (key) => window.electronAPI!.db.getItem(key),
        setItem: (key, value) => {
          const res = window.electronAPI!.db.setItem(key, value)
          if (res && res.ok === false) throw new Error(res.error || 'Database write failed')
        },
        removeItem: (key) => {
          const res = window.electronAPI!.db.removeItem(key)
          if (res && res.ok === false) throw new Error(res.error || 'Database write failed')
        },
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

type RemoveItemListener = (key: string, prevValue: string | null) => void
const removeItemListeners: RemoveItemListener[] = []

/**
 * Same idea as onStorageSetItem, for removeItem — added because
 * clearAllData() (src/lib/persistence.ts) used to be invisible to sync
 * entirely: it calls storage.removeItem for every registered store, and
 * with no listener channel here, the tracker never saw it, so a "delete
 * everything" never produced a single delete op for any other device to
 * apply. Kept as a separate listener list rather than folding into
 * onStorageSetItem's — a removal has no `nextValue`, and every existing
 * caller of onStorageSetItem is written against the 3-argument shape.
 */
export function onStorageRemoveItem(listener: RemoveItemListener): () => void {
  removeItemListeners.push(listener)
  return () => {
    const i = removeItemListeners.indexOf(listener)
    if (i >= 0) removeItemListeners.splice(i, 1)
  }
}

interface StorageErrorInfo {
  /** 'write' — a synchronous setItem/removeItem failed. 'persist' — a later
   *  background flush to disk failed (Electron only; pushed from main). */
  kind: 'write' | 'persist' | string
  message: string
}
type StorageErrorListener = (info: StorageErrorInfo) => void
const storageErrorListeners: StorageErrorListener[] = []

/**
 * Subscribe to storage write failures — a synchronous setItem/removeItem that
 * threw, or (Electron) a background SQLite flush that failed after the fact.
 * StorageErrorBanner uses this to tell the user their last change may not have
 * reached disk. Returns an unsubscribe function.
 */
export function onStorageError(listener: StorageErrorListener): () => void {
  storageErrorListeners.push(listener)
  return () => {
    const i = storageErrorListeners.indexOf(listener)
    if (i >= 0) storageErrorListeners.splice(i, 1)
  }
}

function emitStorageError(info: StorageErrorInfo): void {
  for (const listener of storageErrorListeners) listener(info)
}

// Electron's main process pushes deferred flush failures here (see
// electron/preload.ts's onStorageError and server/db.ts's onPersistError).
if (typeof window !== 'undefined') {
  window.electronAPI?.onStorageError?.((info) => emitStorageError(info))
}

export const storageAdapter: StorageAdapter = {
  getItem: (key) => rawAdapter.getItem(key),
  setItem: (key, value) => {
    const prevValue = rawAdapter.getItem(key)
    try {
      rawAdapter.setItem(key, value)
    } catch (err) {
      emitStorageError({ kind: 'write', message: err instanceof Error ? err.message : String(err) })
      throw err
    }
    for (const listener of setItemListeners) listener(key, prevValue, value)
  },
  removeItem: (key) => {
    const prevValue = rawAdapter.getItem(key)
    try {
      rawAdapter.removeItem(key)
    } catch (err) {
      emitStorageError({ kind: 'write', message: err instanceof Error ? err.message : String(err) })
      throw err
    }
    for (const listener of removeItemListeners) listener(key, prevValue)
  },
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
