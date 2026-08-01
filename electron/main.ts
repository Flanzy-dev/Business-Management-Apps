const { app, BrowserWindow, ipcMain, shell } = require('electron')
const path = require('path')
const os = require('os')
// Real SQLite storage for the app's Zustand `persist` stores (see
// src/lib/storageAdapter.ts) and the HTTP+SSE server that lets other devices
// on the shop's WiFi see the same data — both now live in server/, shared
// with the standalone Ubuntu-server deployment (server/index.ts), so the
// protocol can't drift between "the shop PC is the host" and "a Ubuntu box
// is the host". See server/db.ts and server/syncServer.ts for the
// implementation; this file only wires them up for Electron.
const { openDatabase } = require('../dist-server/db')
const { createSyncServer } = require('../dist-server/syncServer')

let mainWindow: typeof BrowserWindow.prototype | null = null
let db: any = null
let syncServerHandle: { close(): void } | null = null

// --- LAN server -------------------------------------------------------
// Serves the shop's data to every other device on the WiFi: this Electron
// process is the one thing that has to be running (see CLAUDE.md's
// multi-device design note) unless a standalone server/index.ts deployment
// (e.g. an always-on Ubuntu box) is chosen as the host instead — see
// src/lib/sync/hostConfig.ts. Port 5174, deliberately separate from Vite's
// 5173 — in dev a tablet still talks to the Vite dev server it already
// bookmarked, which proxies /api/* here (see vite.config.ts); in a packaged
// build there is no Vite server, so this also serves the built app itself.
const LAN_PORT = 5174

/** Reads the shop's display name straight out of the key_value_store row for
 *  settings-store, for the /api/info handshake a follower device's "Test
 *  connection" uses to confirm it reached the shop it meant to — see
 *  src/pages/Settings.tsx. Not read through the zustand store: this runs in
 *  the main process, which has no React/zustand of its own. */
function getShopName(): string {
  try {
    const raw = db.getItem('settings-store')
    if (!raw) return '—'
    const parsed = JSON.parse(raw)
    return parsed?.state?.shopName ?? '—'
  } catch {
    return '—'
  }
}

async function initDatabase() {
  const dbFilePath = path.join(app.getPath('userData'), 'surya-baru.db')
  db = await openDatabase(dbFilePath)
}

function startLanServer(): void {
  // No token on the embedded shop-PC server by default — the shop password
  // (Part B/C of the multi-device plan) is something a *follower* device
  // types in when pointed at a server that requires one, e.g. the standalone
  // Ubuntu deployment (SHOP_TOKEN env var, see server/index.ts). Today's
  // shop-PC setups keep working exactly as before.
  const { server, close } = createSyncServer({
    db,
    distDir: path.join(__dirname, '../dist'),
    getShopName,
  })
  syncServerHandle = { close }

  server.listen(LAN_PORT, '0.0.0.0', () => {
    console.log(`LAN server listening on http://0.0.0.0:${LAN_PORT} — other devices on this WiFi can reach the shop's data here.`)
  })

  app.on('before-quit', () => {
    syncServerHandle?.close()
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    show: false
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(async () => {
  await initDatabase()
  startLanServer()
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.on('before-quit', () => {
  db?.persist()
})

ipcMain.handle('get-app-path', () => {
  return app.getPath('userData')
})

// tel:/wa.me links (Reminders page) can't navigate the renderer directly —
// Electron denies unknown-scheme/external navigation by default — so they're
// handed to the OS's own handler instead.
ipcMain.handle('open-external', (_event: any, url: string) => {
  shell.openExternal(url)
})

// The shop PC's own window loads via file://, so window.location can't tell
// it (or the Settings page's "type this into a tablet" hint) what address
// another device on the WiFi could actually reach it at — this is the one
// thing only the main process can answer. Picks the first non-internal IPv4
// address; a shop PC realistically has exactly one active WiFi/Ethernet
// adapter, so "first" is enough without needing UI to choose an interface.
ipcMain.handle('get-lan-address', () => {
  const interfaces = os.networkInterfaces()
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address
      }
    }
  }
  return null
})

// Synchronous by design (ipcRenderer.sendSync / event.returnValue) so the
// renderer-side bridge in storageAdapter.ts can implement the same
// synchronous StorageAdapter interface every Zustand store already expects
// — no store, page, or test needed to change for this to work.
ipcMain.on('db:getItem', (event: any, key: string) => {
  event.returnValue = db.getItem(key)
})
ipcMain.on('db:setItem', (event: any, key: string, value: string) => {
  db.setItem(key, value)
  event.returnValue = null
})
ipcMain.on('db:removeItem', (event: any, key: string) => {
  db.removeItem(key)
  event.returnValue = null
})
