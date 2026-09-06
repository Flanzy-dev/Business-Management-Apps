// Whether this device's receipt-print button should stay enabled. Printing
// deliberately stays a shop-PC job (CLAUDE.md/the touchscreen-pass plan):
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
