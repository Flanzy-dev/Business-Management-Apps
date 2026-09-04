const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  getLanAddress: () => ipcRenderer.invoke('get-lan-address'),
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
})
