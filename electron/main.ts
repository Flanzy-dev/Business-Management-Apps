const { app, BrowserWindow, ipcMain, shell, dialog, Menu } = require('electron')
const path = require('path')
const os = require('os')
const fs = require('fs')

// Dev builds (npm run electron:dev / electron:open — anything not a real
// packaged/installed app) get their own userData folder, so testing here
// can never touch the official app's real business data.
if (!app.isPackaged) {
  app.setPath('userData', path.join(app.getPath('userData'), '..', `${app.getName()}-dev`))
}
// Real SQLite storage for the app's Zustand `persist` stores (see
// src/lib/storageAdapter.ts) and the HTTP+SSE server that lets other devices
// on the shop's WiFi see the same data — both now live in server/, shared
// with the standalone Ubuntu-server deployment (server/index.ts), so the
// protocol can't drift between "the shop PC is the host" and "a Ubuntu box
// is the host". See server/db.ts and server/syncServer.ts for the
// implementation; this file only wires them up for Electron.
const { openDatabase } = require('../dist-server/server/db')
const { createSyncServer } = require('../dist-server/server/syncServer')
const { readShopName } = require('../dist-server/server/shopName')
const { readShopToken, readWorkerShopToken } = require('../dist-server/server/shopToken')
const { readShopAccounts, readLanTokenForHandover } = require('../dist-server/server/shopAccounts')
const { startDiscoveryResponder, discoverHosts } = require('../dist-server/server/discovery')
const { PERSISTED_STORES, isShopDataKey, DEVICE_LOCAL_KEYS } = require('../dist-server/src/lib/storageKeys')
// electron-updater — checks GitHub Releases for a newer build (see
// package.json's build.publish and README.md's "Releasing" section for the
// feed this reads). Pure JS, no native module, so it ships like any other
// dependency in node_modules/**/* (package.json's build.files).
const { autoUpdater } = require('electron-updater')
// reduceUpdate/INITIAL_UPDATE_STATE is a pure state machine shared verbatim
// with the renderer (src/lib/update/updateState.ts) — compiled here through
// tsconfig.server.json's include list (the same trick storageKeys.ts above
// uses) because vitest doesn't cover electron/**, so the reducer needs to
// live somewhere it can be unit-tested, and tsconfig.electron.json's rootDir
// means main.ts can't import src/ directly.
const { reduceUpdate, INITIAL_UPDATE_STATE } = require('../dist-server/src/lib/update/updateState')

let mainWindow: typeof BrowserWindow.prototype | null = null
let db: any = null
let syncServerHandle: { close(): void } | null = null
let discoveryHandle: { close(): void } | null = null
// The single source of truth for what the renderer's Settings > Updates
// card and the "restart to install" banner show — see
// src/lib/update/updateState.ts. Pushed to the renderer on every
// transition (pushUpdateState below); also readable on demand via the
// 'get-update-state' IPC handler, because main starts its first check 45s
// after launch — long before React has necessarily mounted anything to
// receive a push — and a freshly-mounted component needs to be able to
// prime itself from whatever state already happened.
let updateState: unknown = INITIAL_UPDATE_STATE
// Set by initDatabase() — module-level so the corrupt-database recovery
// path and the automatic-backup rotation (both below) can find the file
// without recomputing app.getPath('userData') themselves.
let dbFilePath: string | null = null

// Two instances of this app would each hold a separate in-memory copy of
// the database and each flush a full dump on write — last one to flush wins
// and silently destroys whatever the other instance did. requestSingleInstanceLock
// makes the second launch hand off to the first one (via 'second-instance'
// below) and quit instead of opening a second window onto the same file.
const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})

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

async function initDatabase() {
  dbFilePath = path.join(app.getPath('userData'), 'surya-baru.db')
  db = await openDatabase(dbFilePath, (message: string) => {
    // A deferred SQLite flush failed — tell the renderer so its
    // StorageErrorBanner can warn the user (server/db.ts's onPersistError).
    mainWindow?.webContents?.send('db:error', { kind: 'persist', message })
  })
}

/**
 * initDatabase() threw — the file exists but couldn't be opened (locked,
 * corrupted, or otherwise unreadable; see server/db.ts's openDatabase for
 * what does and doesn't reach here since its ENOENT-vs-everything-else fix).
 * Never proceeds to createWindow() on an unopened database — the old
 * behavior was no `.catch` at all, so the promise rejected, no window was
 * ever created, and the user just saw the app fail to launch with nothing
 * to click and nothing explaining why.
 *
 * Returns true once `db` holds a real, opened database again (recovery
 * chose to restore from backup or start fresh) — false if the user chose
 * to quit or a recovery attempt itself failed.
 */
/**
 * The dialog copy for a corrupt-database prompt — pure, so it's testable on
 * its own for the first time (nothing importing this file can run outside
 * Electron). Was two full copies of the "Your data has not been deleted…"
 * detail text, one per hasBackup branch, differing only in whether the
 * Restore bullet exists — the Start/Quit bullets were identical duplicated
 * text in both.
 *
 * Note (not fixed here, flagged for a follow-up): `choice` downstream is
 * matched against these exact English button labels, not a stable id — a
 * future copy edit here would silently break applyRecoveryChoice's branching.
 */
function buildRecoveryPrompt(
  message: string,
  hasBackup: boolean
): { buttons: string[]; detail: string; defaultId: number; cancelId: number } {
  const buttons = hasBackup
    ? ['Restore from backup', 'Start with an empty database', 'Quit']
    : ['Start with an empty database', 'Quit']
  const bullets = [
    hasBackup &&
      '• Restore from backup — the last automatic backup, which may be a few minutes behind.',
    '• Start with an empty database — the damaged file is renamed, never deleted, so it can still be recovered later.',
    '• Quit — fix the problem (e.g. close whatever else has the file open) and reopen the app.',
  ]
    .filter((line): line is string => !!line)
    .join('\n')
  return {
    buttons,
    detail: `${message}\n\nYour data has not been deleted. Choose how to proceed:\n\n${bullets}`,
    defaultId: 0,
    cancelId: buttons.length - 1,
  }
}

/**
 * Carries out whichever recovery the user picked. Returns the freshly opened
 * database on success, or null for "Quit"/an unrecognized choice — the
 * caller decides what null means (recoverFromCorruptDatabase treats it as
 * "not recovered").
 */
async function applyRecoveryChoice(choice: string | undefined, dbFilePath: string): Promise<any> {
  if (choice === 'Restore from backup') {
    fs.copyFileSync(`${dbFilePath}.bak`, dbFilePath)
    return openDatabase(dbFilePath)
  }
  if (choice === 'Start with an empty database') {
    const corruptPath = `${dbFilePath}.corrupt-${Date.now()}`
    if (fs.existsSync(dbFilePath)) fs.renameSync(dbFilePath, corruptPath)
    return openDatabase(dbFilePath)
  }
  return null
}

async function recoverFromCorruptDatabase(err: unknown): Promise<boolean> {
  const message = err instanceof Error ? err.message : String(err)
  console.error('Failed to open database:', message)
  if (!dbFilePath) return false

  const hasBackup = fs.existsSync(`${dbFilePath}.bak`)
  const prompt = buildRecoveryPrompt(message, hasBackup)
  const choiceIndex = dialog.showMessageBoxSync({
    type: 'error',
    title: 'Surya Baru — database problem',
    message: "The shop's database could not be opened.",
    detail: prompt.detail,
    buttons: prompt.buttons,
    defaultId: prompt.defaultId,
    cancelId: prompt.cancelId,
  })
  const choice = prompt.buttons[choiceIndex]

  try {
    const recovered = await applyRecoveryChoice(choice, dbFilePath)
    if (recovered) {
      db = recovered
      return true
    }
  } catch (recoveryErr) {
    dialog.showErrorBox(
      'Recovery failed',
      recoveryErr instanceof Error ? recoveryErr.message : String(recoveryErr)
    )
  }
  return false
}

/**
 * A dated copy of the database on every clean quit, alongside the manual
 * Settings > Backup export — the manual one only happens if someone
 * remembers to click it. Keeps the newest 7 generations; older ones are
 * deleted so this can't grow without bound.
 */
function rotateAutomaticBackup(): void {
  if (!dbFilePath) return
  try {
    const backupsDir = path.join(app.getPath('userData'), 'backups')
    fs.mkdirSync(backupsDir, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    fs.copyFileSync(dbFilePath, path.join(backupsDir, `surya-baru-${stamp}.db`))

    const KEEP = 7
    const files = fs
      .readdirSync(backupsDir)
      .filter((f: string) => f.startsWith('surya-baru-') && f.endsWith('.db'))
      .sort()
    for (const stale of files.slice(0, Math.max(0, files.length - KEEP))) {
      fs.unlinkSync(path.join(backupsDir, stale))
    }
  } catch (err) {
    console.error('Automatic backup failed:', err)
  }
}

function startLanServer(): void {
  // No token required by default — the shop's admin turns on "Require token
  // on LAN" in Settings > Security once they've had a chance to see and
  // copy the generated token, so updating the app never 401s a tablet mid-
  // shift with a token nobody's seen (see server/shopToken.ts's
  // lanTokenRequired check). A getter, not a snapshot taken here at
  // startup: syncServer.ts re-reads it on every request, so flipping the
  // switch in Settings takes effect immediately, with no app restart.
  const { server, close } = createSyncServer({
    db,
    distDir: path.join(__dirname, '../dist'),
    // The shop name a follower device sees when it presses "Test connection"
    // — see server/shopName.ts, shared with the standalone deployment.
    getShopName: () => readShopName(db),
    token: () => readShopToken(db),
    // Worker-tier counterpart — see server/shopToken.ts's readWorkerShopToken
    // and src/store/securityStore.ts's workerLanToken doc for why a worker
    // credential needs a DIFFERENT token from the admin one.
    workerToken: () => readWorkerShopToken(db),
    allowedEntities: PERSISTED_STORES.map((s: { storageKey: string }) => s.storageKey),
    isSyncableKey: isShopDataKey,
    // Lets another device pair by signing in with the shop's own username
    // and password instead of being told a generated token — see
    // server/syncServer.ts's handleLogin. Getters, not snapshots: an account
    // can be created minutes after this server started.
    getAccounts: () => readShopAccounts(db),
    getLanToken: (role: 'admin' | 'worker') => readLanTokenForHandover(db, role),
    // For the follower version-skew warning (SyncRoleSection.tsx) — see
    // src/lib/update/versionCompare.ts. app.getVersion() reads the packaged
    // build's own version, which always matches package.json at build time.
    getAppVersion: () => app.getVersion(),
  })
  syncServerHandle = { close }

  // Lets a second install find this one without anyone reading an IP off
  // this screen — see server/discovery.ts. Best-effort by design: if the
  // UDP bind fails (port busy, hardened network), the other device just
  // types the address in Settings the way it always could.
  discoveryHandle = startDiscoveryResponder({
    getShopName: () => readShopName(db),
    syncPort: LAN_PORT,
    onError: (err: Error) => console.error('Discovery responder unavailable:', err.message),
  })

  server.listen(LAN_PORT, '0.0.0.0', () => {
    console.log(`LAN server listening on http://0.0.0.0:${LAN_PORT} — other devices on this WiFi can reach the shop's data here.`)
  })

  // Most commonly EADDRINUSE from a second instance racing this one before
  // the single-instance lock above turns it away — without a handler this
  // is an uncaught exception that crashes the whole app the shop is using,
  // not just the LAN server.
  server.on('error', (err: Error) => {
    console.error('LAN server error:', err)
  })

  app.on('before-quit', () => {
    syncServerHandle?.close()
    discoveryHandle?.close()
  })
}

// DevTools give a renderer-side script full run of window.electronAPI —
// including the unrestricted db:getItem/db:setItem bridge (see
// electron/preload.ts), which can read both password hashes straight out
// of security-store and write an admin session into auth-mode with no
// credential at all (see src/lib/auth/storedSession.ts's header for why
// that marker is deliberately forgeable by anyone who can reach it). That
// is a two-minutes-alone-at-the-counter attack, not a sophisticated one, so
// it's worth closing even though it doesn't stop someone determined (the
// SQLite file itself is still plaintext, and Electron's own
// --remote-debugging-port flag still exists for whoever controls how this
// process is launched). Only in a packaged build — app.isPackaged is false
// for `npm run electron:dev`/`electron:open`, so this never gets in the way
// of development.
function disableDevToolsInPackagedBuild(window: typeof BrowserWindow.prototype): void {
  if (!app.isPackaged) return

  // Removes the whole native menu bar, which is also where the default
  // View > Toggle Developer Tools item lives — there is no per-item removal
  // API, so this is the standard way to drop just that one.
  Menu.setApplicationMenu(null)

  // The menu item is gone, but the accelerators (F12, Ctrl+Shift+I) still
  // fire without it — Electron binds them at the BrowserWindow level, not
  // through the menu. Swallow them here instead. Ordinary shortcuts
  // (Ctrl+C/V/X, Ctrl+A, arrow keys, …) are unaffected: Chromium handles
  // those natively for whatever's focused and never reaches this handler.
  window.webContents.on('before-input-event', (event: any, input: any) => {
    const key = typeof input.key === 'string' ? input.key.toLowerCase() : ''
    const isF12 = key === 'f12'
    const isCtrlShiftI = input.control && input.shift && key === 'i'
    if (isF12 || isCtrlShiftI) {
      event.preventDefault()
    }
  })
}

// --- Auto-update ---------------------------------------------------------
// Checks GitHub Releases for a newer build (package.json's build.publish),
// downloads it in the background, and waits for someone to press
// "Restart & install" — never installs on its own. See
// src/lib/update/updateState.ts for the state machine this drives and
// docs/README.md's "Releasing" section for how a release actually reaches
// this feed.

/** Where "it never updated" gets diagnosed from — packaged builds have no
 *  DevTools (see disableDevToolsInPackagedBuild above), so this file is the
 *  only record a shop can be asked to check. Best-effort: a failed write
 *  here must never be the reason an update check itself fails. */
function logUpdateEvent(line: string): void {
  console.log(`[update] ${line}`)
  try {
    const logPath = path.join(app.getPath('userData'), 'update.log')
    fs.appendFileSync(logPath, `${new Date().toISOString()} ${line}\n`)
  } catch {
    // Diagnostic-only; swallow so a full disk or locked file can't turn a
    // logging failure into an update failure.
  }
}

const updateLogger = {
  info: (msg: string) => logUpdateEvent(`info: ${msg}`),
  warn: (msg: string) => logUpdateEvent(`warn: ${msg}`),
  error: (msg: string) => logUpdateEvent(`error: ${msg}`),
  debug: () => {},
}

function pushUpdateState(next: unknown): void {
  updateState = next
  mainWindow?.webContents?.send('update:state', next)
}

function applyUpdateEvent(event: unknown): void {
  pushUpdateState(reduceUpdate(updateState, event))
}

/**
 * Runs one check. `trigger: 'auto'` is what the reducer uses to decide
 * whether a failure or a "nothing new" result stays invisible (see
 * updateState.ts's file header) — a manual press of "Check for updates"
 * always shows its result, an automatic background check never bothers
 * anyone with one.
 *
 * The device's own opt-out (Settings > Updates' toggle) is read straight
 * out of this device's SQLite via db.getItem — the same one-source-of-truth
 * trick server/shopToken.ts's readShopToken uses for the LAN token — rather
 * than a separate IPC round trip just to learn one flag. A manual check
 * always runs regardless of the toggle: pressing the button IS the
 * permission.
 */
async function runUpdateCheck(trigger: 'auto' | 'manual'): Promise<void> {
  if (trigger === 'auto' && db?.getItem(DEVICE_LOCAL_KEYS.autoUpdate) === 'off') return
  applyUpdateEvent({ type: 'check-started', trigger })
  try {
    await autoUpdater.checkForUpdates()
  } catch {
    // checkForUpdates() both rejects AND emits 'error' (below) for the same
    // failure — swallow the rejection here so it isn't ALSO an unhandled
    // promise rejection; the 'error' listener is what actually updates
    // state and logs.
  }
}

const AUTO_CHECK_DELAY_MS = 45_000 // not zero: a slow/absent DNS must never delay reaching a work order
const AUTO_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000

function initAutoUpdater(): void {
  // Never in dev: a dev run has no app-update.yml (electron-builder only
  // writes it into a packaged build — see package.json's build.publish) and
  // its "version" is whatever package.json currently says mid-edit.
  // SURYA_UPDATE_DEV=1 is the escape hatch documented in README.md for
  // testing the whole flow against a local feed without a real release —
  // see forceDevUpdateConfig below. Same app.isPackaged discriminator as
  // the userData dev/prod split at the top of this file.
  if (!app.isPackaged && process.env.SURYA_UPDATE_DEV !== '1') return
  if (!app.isPackaged) autoUpdater.forceDevUpdateConfig = true

  autoUpdater.autoDownload = true // download in the background — no prompt to start
  autoUpdater.autoInstallOnAppQuit = false // never install without someone pressing the button
  autoUpdater.allowPrerelease = false
  autoUpdater.allowDowngrade = false
  autoUpdater.logger = updateLogger

  autoUpdater.on('update-available', (info: { version: string }) =>
    applyUpdateEvent({ type: 'update-available', version: info.version })
  )
  autoUpdater.on('update-not-available', () =>
    applyUpdateEvent({ type: 'update-not-available', currentVersion: app.getVersion() })
  )
  autoUpdater.on('download-progress', (p: { percent: number }) =>
    applyUpdateEvent({ type: 'download-progress', percent: p.percent })
  )
  autoUpdater.on('update-downloaded', (info: { version: string }) =>
    applyUpdateEvent({ type: 'update-downloaded', version: info.version })
  )
  // MANDATORY, not optional. autoUpdater is a plain Node EventEmitter —
  // with no 'error' listener, Node rethrows the error as an uncaught
  // exception and takes down the whole app the shop is using, on the very
  // first check that has no internet. A shop with no connection (or one
  // that's just down for a minute) emits one of these on EVERY scheduled
  // check, forever, so this must never be skipped.
  autoUpdater.on('error', (err: Error) => {
    logUpdateEvent(`update check failed: ${err.message}`)
    applyUpdateEvent({ type: 'error', message: err.message })
  })

  setTimeout(() => {
    void runUpdateCheck('auto')
  }, AUTO_CHECK_DELAY_MS)
  setInterval(() => {
    void runUpdateCheck('auto')
  }, AUTO_CHECK_INTERVAL_MS)
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

  disableDevToolsInPackagedBuild(mainWindow)

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
  if (!gotSingleInstanceLock) return
  try {
    await initDatabase()
  } catch (err) {
    const recovered = await recoverFromCorruptDatabase(err)
    if (!recovered) {
      app.quit()
      return
    }
  }
  startLanServer()
  createWindow()
  // After createWindow() so mainWindow exists before the first push could
  // ever fire (it can't for AUTO_CHECK_DELAY_MS anyway, but the ordering
  // makes that not matter). Also after the single-instance-lock guard
  // above (see the `if (!gotSingleInstanceLock) return` at the top of this
  // handler) — a losing second instance must never start a background
  // download it will just quit on top of.
  initAutoUpdater()
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

// Load-bearing for auto-update, not just a normal-quit convenience:
// autoUpdater.quitAndInstall() (the 'install-update' handler below) calls
// app.quit() internally, so THIS handler is what flushes the database and
// rotates the backup before the installer replaces the app's files. Never
// add an event.preventDefault() here (or anywhere else on 'before-quit') —
// it would silently break both a normal quit's data safety AND every
// install-update.
app.on('before-quit', () => {
  db?.persist()
  rotateAutomaticBackup()
})

ipcMain.handle('get-app-path', () => {
  return app.getPath('userData')
})

// tel:/wa.me links (Reminders page) can't navigate the renderer directly —
// Electron denies unknown-scheme/external navigation by default — so they're
// handed to the OS's own handler instead.
// shell.openExternal below hands this straight to the OS's protocol handler,
// so an unexpected scheme is an OS-level primitive (ms-msdt: and similar),
// not merely a bad link. Today's only callers build tel:/https: URLs with the
// scheme hardcoded (src/components/reminders/ContactRow.tsx), but that
// guarantee belongs here in main rather than in the renderer this process is
// supposed to be defending against.
const OPEN_EXTERNAL_SCHEMES = new Set(['tel:', 'https:', 'http:', 'mailto:'])

ipcMain.handle('open-external', (_event: any, url: string) => {
  let scheme: string
  try {
    scheme = new URL(url).protocol
  } catch {
    // Not a parseable URL at all — nothing to hand the OS.
    return
  }
  // Silent no-op rather than a throw: neither real caller can reach this, and
  // a rejected link should not surface to the shop as an error dialog.
  if (!OPEN_EXTERNAL_SCHEMES.has(scheme)) return
  shell.openExternal(url)
})

// The shop PC's own window loads via file://, so window.location can't tell
// it (or the Settings page's "type this into a tablet" hint) what address
// another device on the WiFi could actually reach it at — this is the one
// thing only the main process can answer. Picks the first non-internal IPv4
// address; a shop PC realistically has exactly one active WiFi/Ethernet
// adapter, so "first" is enough without needing UI to choose an interface.
// Finds other Surya Baru hosts on this network so Settings > Multi-device
// sync can offer them as a list instead of an empty address field. Lives in
// main because it needs a UDP socket, which the renderer has no access to
// (and a browser tab running this same app never can — that case doesn't
// need it, see server/discovery.ts's header). Always resolves, never
// rejects: "nothing found" is an ordinary answer here, not an error.
ipcMain.handle('discover-hosts', async () => {
  try {
    return await discoverHosts()
  } catch {
    return []
  }
})

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

// Not for display (src/lib/appVersion.ts's __APP_VERSION__ is already
// correct and synchronous, with no round trip or loading flicker) — this
// exists for the update-check log and the /api/info handshake, where what
// matters is the actual installed binary's version rather than whatever
// the renderer bundle was stamped with at build time. The two are supposed
// to always agree; this is exactly the code whose job is to notice if they
// ever don't.
ipcMain.handle('get-app-version', () => app.getVersion())

// Primes a freshly-mounted renderer component: initAutoUpdater's first
// check doesn't fire until AUTO_CHECK_DELAY_MS after launch, but a restart
// caused by a PREVIOUS session's "Restart & install" could have left
// something worth showing already, and in general a push-only channel
// misses whatever happened before a component subscribed to it.
ipcMain.handle('get-update-state', () => updateState)

ipcMain.handle('check-for-updates', async () => {
  await runUpdateCheck('manual')
})

ipcMain.handle('install-update', () => {
  // Guard against a stale/racing renderer call — quitAndInstall() only
  // makes sense once a download actually finished.
  if ((updateState as { status?: string })?.status !== 'ready') return
  // isSilent=true: run the one-click NSIS installer without its own UI —
  // nsis.perMachine is false (package.json), so this needs no UAC prompt.
  // isForceRunAfter=true: relaunch once done — the user asked for exactly
  // this by pressing the button, which is what "never auto-restart on its
  // own" (see initAutoUpdater's autoInstallOnAppQuit=false) still allows.
  autoUpdater.quitAndInstall(true, true)
})

// Synchronous by design (ipcRenderer.sendSync / event.returnValue) so the
// renderer-side bridge in storageAdapter.ts can implement the same
// synchronous StorageAdapter interface every Zustand store already expects
// — no store, page, or test needed to change for this to work.
//
// Shared by both write channels below: same success/failure contract, same
// 'db:error' push to the renderer on failure — kept as one function so a
// third write channel can't silently drift from this shape.
function respondToDbWrite(event: any, write: () => void): void {
  try {
    write()
    event.returnValue = { ok: true }
  } catch (err: any) {
    const message = err instanceof Error ? err.message : String(err)
    event.returnValue = { ok: false, error: message }
    mainWindow?.webContents?.send('db:error', { kind: 'write', message })
  }
}

ipcMain.on('db:getItem', (event: any, key: string) => {
  event.returnValue = db.getItem(key)
})
ipcMain.on('db:setItem', (event: any, key: string, value: string) => {
  respondToDbWrite(event, () => db.setItem(key, value))
})
ipcMain.on('db:removeItem', (event: any, key: string) => {
  respondToDbWrite(event, () => db.removeItem(key))
})
