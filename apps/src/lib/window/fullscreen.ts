// Renderer-side wrapper around fullscreen — either Electron's window-level
// fullscreen (bridged through electron/preload.ts, actually toggled in
// electron/main.ts's createWindow()) or, for a browser tab (a LAN tablet
// served by server/syncServer.ts), the DOM's own Fullscreen API. Mirrors
// src/lib/update/updateBridge.ts structurally on purpose — same "declare the
// electronAPI shape inline at the one place that needs it" convention this
// project uses instead of a shared .d.ts, same feature-detection-first
// pattern, same optional-call guards (the renderer bundle and preload script
// are separately built artifacts that can be version-mismatched in dev).
//
// Electron is routed through IPC rather than calling requestFullscreen() in
// both cases: window-level fullscreen and HTML fullscreen are two different
// states there, so an F11 press (window-level, handled entirely in main.ts)
// would otherwise leave document.fullscreenElement null and this module's
// browser-side check out of sync with what's actually on screen.

interface FullScreenBridge {
  toggleFullScreen?: () => Promise<void>
  isFullScreen?: () => Promise<boolean>
  onFullScreenChange?: (cb: (on: boolean) => void) => () => void
}

function bridge(): FullScreenBridge | null {
  if (typeof window === 'undefined') return null
  return (window as unknown as { electronAPI?: FullScreenBridge }).electronAPI ?? null
}

function hasElectronBridge(): boolean {
  return typeof bridge()?.toggleFullScreen === 'function'
}

function hasDomFullscreen(): boolean {
  return typeof document !== 'undefined' && typeof document.documentElement.requestFullscreen === 'function'
}

/** Whether this device can toggle fullscreen at all — false on a browser
 *  that exposes no Fullscreen API (rare, but real on some embedded/kiosk
 *  webviews), so the topbar button can hide rather than sit there dead. */
export function canToggleFullScreen(): boolean {
  return hasElectronBridge() || hasDomFullscreen()
}

/** No-op when neither path is available (see canToggleFullScreen) — callers
 *  don't need to guard every call site themselves. */
export async function toggleFullScreen(): Promise<void> {
  const api = bridge()
  if (typeof api?.toggleFullScreen === 'function') {
    await api.toggleFullScreen()
    return
  }
  if (!hasDomFullscreen()) return
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen()
    } else {
      await document.documentElement.requestFullscreen()
    }
  } catch {
    // requestFullscreen() rejects when called outside a user gesture (or
    // when the browser otherwise refuses) — the button press IS the
    // gesture in the normal case, so this only guards the odd rejection;
    // there's nothing else useful to do with it here.
  }
}

/**
 * Primes `cb` with the current fullscreen state, then subscribes to further
 * changes from whichever source is available (F11, the button itself, the
 * OS/browser's own gesture). Returns an unsubscribe; always safe to call
 * even when canToggleFullScreen() is false (it just never invokes `cb`, and
 * unsubscribing is a no-op).
 */
export function subscribeFullScreen(cb: (isFullScreen: boolean) => void): () => void {
  const api = bridge()
  if (typeof api?.isFullScreen === 'function' && typeof api.onFullScreenChange === 'function') {
    let unsubscribed = false
    void api.isFullScreen().then((on) => {
      if (!unsubscribed) cb(on)
    })
    const unsubscribe = api.onFullScreenChange(cb)
    return () => {
      unsubscribed = true
      unsubscribe()
    }
  }

  if (!hasDomFullscreen()) return () => {}

  const handler = () => cb(!!document.fullscreenElement)
  handler()
  document.addEventListener('fullscreenchange', handler)
  return () => document.removeEventListener('fullscreenchange', handler)
}
