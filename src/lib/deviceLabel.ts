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

  // The desktop app currently ships for Windows only (see CLAUDE.md), but
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
