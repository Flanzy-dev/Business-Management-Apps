const { app, BrowserWindow, ipcMain, shell } = require('electron')
const path = require('path')
// Real SQLite storage for the app's Zustand `persist` stores (see
// src/lib/storageAdapter.ts). The main process is the only thing that touches
// the database file; the renderer reaches it through the synchronous db:*
// IPC handlers at the bottom of this file. See electron/db.ts.
const { openDatabase } = require('./db')

let mainWindow: typeof BrowserWindow.prototype | null = null
let db: any = null

async function initDatabase() {
  const dbFilePath = path.join(app.getPath('userData'), 'surya-baru.db')
  db = await openDatabase(dbFilePath)
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
