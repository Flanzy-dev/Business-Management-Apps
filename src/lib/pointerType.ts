// Decides whether a click came from a finger, so src/lib/rowInteraction.ts's
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
