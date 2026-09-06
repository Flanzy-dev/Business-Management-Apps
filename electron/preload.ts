const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  getLanAddress: () => ipcRenderer.invoke('get-lan-address'),
  // Broadcasts a UDP probe and returns whichever hosts answer — used by the
  // sync settings card so pairing never requires typing an IP. Resolves to
  // an empty array when nothing answers; that is a normal outcome (no host
  // running, or a network that drops broadcasts), not a failure.
  discoverHosts: () => ipcRenderer.invoke('discover-hosts'),
  db: {
    getItem: (key: string) => ipcRenderer.sendSync('db:getItem', key),
    // Returns { ok, error } rather than throwing across the IPC boundary —
    // storageAdapter.ts turns a failed result back into a throw.
    setItem: (key: string, value: string) => ipcRenderer.sendSync('db:setItem', key, value),
    removeItem: (key: string) => ipcRenderer.sendSync('db:removeItem', key),
  },
  // Main pushes here when a deferred SQLite flush fails (server/db.ts's
  // onPersistError) — storageAdapter.ts forwards it to StorageErrorBanner.
  onStorageError: (cb: (info: { kind: string; message: string }) => void) => {
    ipcRenderer.on('db:error', (_e: unknown, info: { kind: string; message: string }) => cb(info))
  },
  // Auto-update bridge — see electron/main.ts's "Auto-update" section and
  // src/lib/update/updateBridge.ts, which is the only renderer-side code
  // that should call these directly.
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getUpdateState: () => ipcRenderer.invoke('get-update-state'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  // Unlike onStorageError above, this DOES return an unsubscribe — two
  // independent components (the Settings update card and the "restart to
  // install" banner) each subscribe on mount, and React StrictMode
  // double-mounts every component in dev, so without a way to remove the
  // old listener each remount would leak another one calling `cb`.
  onUpdateState: (cb: (state: unknown) => void) => {
    const handler = (_e: unknown, state: unknown) => cb(state)
    ipcRenderer.on('update:state', handler)
    return () => ipcRenderer.removeListener('update:state', handler)
  },
})
