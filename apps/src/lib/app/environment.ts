// Small related modules kept in one file, one section each with its original notes: appVersion,
// deviceId, deviceLabel, isTouchPrimary, pointerType.
import { storageAdapter } from '../storage/storageAdapter'
import { newId } from '../format/id'
import { DEVICE_LOCAL_KEYS } from '../storage/storageKeys'

// ---- appVersion ----

// The version this renderer bundle was built from — see vite.config.ts's
// `define`, which reads it straight out of package.json. For an Electron
// install this always equals app.getVersion(), since both are produced by
// the same build from the same package.json; for a LAN browser tab it is
// the version of whatever host served this bundle, which is exactly what
// should be displayed (see src/lib/update/updateBridge.ts's canAutoUpdate
// doc for why a tab can never itself be "out of date").
//
// Used for on-screen display (sidebar footer, Settings About card, Profile)
// via {{version}} interpolation — see src/lib/i18n's en.ts/id.ts. NOT used
// for the update-check handshake or the update log: those go through
// app.getVersion() over IPC instead (electron/main.ts), because they must
// reflect the actual installed binary, not the bundle Vite happened to
// stamp at build time — the two are supposed to always agree, but the
// update path is exactly the code whose job is to notice if they ever
// don't.
export const APP_VERSION: string = __APP_VERSION__

/** "v1.1.4" — the app version with its conventional display prefix. */
export function versionLabel(version: string = APP_VERSION): string {
  return `v${version}`
}

// ---- deviceId ----

// Stable per-install identifier. Every StockMovement is stamped with the
// device that created it (see src/store/stockMovementStore.ts) and multi-
// device sync (src/lib/sync/) uses it to tell "my unsynced ops" apart from
// "ops I already pulled".
//
// Generated once and cached in whichever storage this device uses (see
// storageAdapter.ts), so it survives reloads but is never shared between
// devices — that's what makes it a *device* id and not an install-wide one.
// See src/lib/storage/storageKeys.ts's DEVICE_LOCAL_KEYS for why this key in
// particular must never be backed up, restored, or synced: a device that
// adopted another device's id would misattribute every StockMovement it
// writes afterward.

let cached: string | null = null

export function getDeviceId(): string {
  if (cached) return cached
  const existing = storageAdapter.getItem(DEVICE_LOCAL_KEYS.deviceId)
  if (existing) {
    cached = existing
    return existing
  }
  const id = newId()
  storageAdapter.setItem(DEVICE_LOCAL_KEYS.deviceId, id)
  cached = id
  return id
}

// ---- deviceLabel ----

// A coarse, best-effort default name for a device that has just self-
// registered into src/store/deviceStore.ts — good enough to tell devices
// apart in a list ("Bay 2 tablet" vs "Windows PC"), editable afterward in
// Settings > Multi-device sync, never re-computed once a device has a row.
//
// Deliberately approximate: there is no reliable cross-platform way to ask
// "what kind of device is this", and getting it exactly right matters far
// less than a shop being able to rename "Windows PC" to something useful
// the first time they open the device list.
export function defaultDeviceLabel(): string {
  if (typeof navigator === 'undefined') return 'Device'
  const ua = navigator.userAgent || ''

  // The desktop app currently ships for Windows only (see README.md's "Releasing"), but
  // sniffing the OS even inside Electron costs nothing and stops this from
  // silently mislabeling a future macOS/Linux build.
  if (typeof window !== 'undefined' && window.electronAPI) {
    if (/Mac OS X/i.test(ua)) return 'Mac'
    if (/Linux/i.test(ua)) return 'Linux PC'
    return 'Windows PC'
  }

  // Everything below is a LAN follower running in a plain browser tab (see
  // src/lib/update/updateBridge.ts's canAutoUpdate doc for why that's the
  // only other case) — a phone, tablet, or another PC's browser.
  if (/iPad/i.test(ua)) return 'iPad'
  if (/iPhone/i.test(ua)) return 'iPhone'
  if (/Android/i.test(ua)) {
    return /Mobile/i.test(ua) ? 'Android phone' : 'Android tablet'
  }
  const coarsePointer = typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches
  return coarsePointer ? 'Tablet' : 'Browser'
}

// ---- isTouchPrimary ----

// Whether this device's receipt-print button should stay enabled. Printing
// deliberately stays a shop-PC job (the touchscreen-pass plan):
// Receipt.tsx's printReceipt opens a sized `window.open` + `window.print()`,
// which mobile browsers routinely pop-up-block, and even when it succeeds it
// drives the TABLET's own print sheet (AirPrint/Android print service), not
// the shop's thermal printer sitting on the shop PC.
//
// `(pointer: coarse)` alone would also disable the button on a touchscreen
// Windows PC actually wired to that thermal printer, so it's gated on BOTH
// halves: a coarse primary pointer AND not running inside Electron. A
// desktop browser tab (`npm run dev`) has neither half true and keeps
// printing enabled, same as today.
export function isTouchPrimary(): boolean {
  if (typeof window === 'undefined') return false
  if (window.electronAPI) return false
  return !!window.matchMedia?.('(pointer: coarse)').matches
}

// ---- pointerType ----

// Decides whether a click came from a finger, so src/lib/app/rowInteraction.ts's
// double-click deferral can skip its 250ms wait on touch without breaking on
// a mouse. Pure and store-free, no DOM types, so Vitest (environment: 'node')
// can exercise it directly — same pattern as src/lib/auth/elevateStep.ts.
//
// Why per-event, not a device-wide "is this a touch device" flag: a
// touchscreen shop PC has both a mouse and a finger, and either one might
// produce any given click — a device-level flag would be wrong half the
// time. Every click decides for itself.
//
// Why not read pointerType off the click alone: Chromium dispatches `click`
// as a PointerEvent, so `event.pointerType` is reliable there. WebKit does
// not — Safari has historically dispatched `click` as a plain MouseEvent
// (pointerType undefined), and even where it IS a PointerEvent the value can
// come through as an empty string. So the click's own pointerType is only
// ever a first-choice corroboration; the caller must also track `pointerdown`
// (a PointerEvent everywhere Pointer Events exist, including Safari 13+) in
// a ref and pass its last-seen kind in as a fallback.

export type PointerKind = 'touch' | 'mouse'

/** Reads a pointer kind off any event-shaped object. Returns null when the
 *  event carries no usable signal — Safari's empty-string pointerType, a
 *  MouseEvent-shaped click, a stylus (deliberately excluded — a pen click
 *  falls through to the same behavior as a mouse), or a keyboard-synthesized
 *  one. */
export function readPointerKind(event: { pointerType?: string } | null | undefined): PointerKind | null {
  switch (event?.pointerType) {
    case 'touch':
      return 'touch'
    case 'mouse':
      return 'mouse'
    default:
      return null
  }
}

/**
 * Should this click skip the double-click deferral and act immediately?
 * TRUE only when we positively know a finger produced it — mouse, pen,
 * unknown, keyboard, and programmatic clicks are all false, so the existing
 * desktop path is preserved by construction rather than by enumerating every
 * case that should stay slow.
 *
 * `click.detail === 0` marks a keyboard-activated (Enter/Space) or
 * programmatic click, which has no preceding pointerdown of its own — without
 * this guard, a stale `lastPointerDownKind === 'touch'` left over from an
 * earlier tap on the same element could leak into a later keyboard
 * activation and skip the deferral it still needs (a screen reader / keyboard
 * user gets no benefit from the touch fast-path and no `dblclick` event ever
 * fires for it, so skipping the defer would just drop the second-click
 * cancellation window).
 */
export function isTouchClick(
  click: { pointerType?: string; detail?: number } | null | undefined,
  lastPointerDownKind: PointerKind | null
): boolean {
  const fromClick = readPointerKind(click)
  if (fromClick) return fromClick === 'touch'
  if (click?.detail === 0) return false
  return lastPointerDownKind === 'touch'
}
