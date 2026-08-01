const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  getLanAddress: () => ipcRenderer.invoke('get-lan-address'),
  db: {
    getItem: (key: string) => ipcRenderer.sendSync('db:getItem', key),
    setItem: (key: string, value: string) => {
      ipcRenderer.sendSync('db:setItem', key, value)
    },
    removeItem: (key: string) => {
      ipcRenderer.sendSync('db:removeItem', key)
    },
  },
})
