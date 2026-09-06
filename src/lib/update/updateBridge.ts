// Renderer-side wrapper around the auto-updater that actually runs in the
// Electron main process (electron/main.ts's "Auto-update" section, bridged
// through electron/preload.ts). Mirrors src/lib/sync/discovery.ts
// structurally on purpose — same "declare the electronAPI shape inline at
// the one place that needs it" convention this project uses instead of a
// shared .d.ts, same feature-detection-first pattern.
//
// A browser tab (a LAN tablet) always reports canAutoUpdate() === false,
// and correctly so — it has no binary of its own to update. It renders
// whatever dist/ its host currently serves, and picks up a newer host's
// frontend on its next reload; see src/lib/appVersion.ts's header for why
// that makes a tab's own version display always correct with zero extra
// code. Do not "fix" this by trying to make a tab check for updates.
import type { UpdateState } from './updateState'

interface UpdateBridge {
  getAppVersion?: () => Promise<string>
  getUpdateState?: () => Promise<UpdateState>
  checkForUpdates?: () => Promise<void>
  installUpdate?: () => Promise<void>
  onUpdateState?: (cb: (state: UpdateState) => void) => () => void
}

function bridge(): UpdateBridge | null {
  if (typeof window === 'undefined') return null
  return (window as unknown as { electronAPI?: UpdateBridge }).electronAPI ?? null
}

/**
 * Whether this device can update itself at all. False in a browser tab (see
 * file header) and false in an Electron build old enough to predate this
 * bridge — the optional-call guard matters because the renderer bundle and
 * the preload script are separately built artifacts that can be
 * version-mismatched in development, the same reason
 * src/lib/sync/discovery.ts's canDiscoverHosts() guards its own call.
 */
export function canAutoUpdate(): boolean {
  return typeof bridge()?.checkForUpdates === 'function'
}

/** No-op when auto-update isn't available (see canAutoUpdate) — callers
 *  don't need to guard every call site themselves. */
export async function checkForUpdates(): Promise<void> {
  const api = bridge()
  if (typeof api?.checkForUpdates !== 'function') return
  await api.checkForUpdates()
}

/** No-op when auto-update isn't available. Only actually installs anything
 *  in the main process once an update has finished downloading — see
 *  electron/main.ts's 'install-update' handler, which checks the state
 *  itself before calling quitAndInstall(). */
export async function installUpdate(): Promise<void> {
  const api = bridge()
  if (typeof api?.installUpdate !== 'function') return
  await api.installUpdate()
}

/**
 * Primes `cb` with whatever state already exists (main can start checking
 * well before any component mounts to receive a push — see
 * electron/main.ts's AUTO_CHECK_DELAY_MS), then subscribes to further
 * pushes. Returns an unsubscribe; always safe to call even when
 * canAutoUpdate() is false (it just never invokes `cb`, and unsubscribing
 * is a no-op).
 */
export function subscribeUpdateState(cb: (state: UpdateState) => void): () => void {
  const api = bridge()
  if (!api?.getUpdateState || !api.onUpdateState) return () => {}

  let unsubscribed = false
  void api.getUpdateState().then((state) => {
    if (!unsubscribed) cb(state)
  })
  const unsubscribe = api.onUpdateState(cb)
  return () => {
    unsubscribed = true
    unsubscribe()
  }
}
