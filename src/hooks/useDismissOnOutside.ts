import { useEffect } from 'react'

/**
 * Close on an outside click or Escape — the exact listener pair Layout.tsx's
 * profile dropdown and DropdownMenu.tsx each hand-wrote identically. Takes a
 * `refs` array rather than two named refs so a future single-ref popover can
 * use it too; a click only counts as "outside" when it lands outside every
 * ref given.
 *
 * Listens on `pointerdown`, not `mousedown` — `mousedown` is only a
 * *compatibility* event on touch, which iOS Safari synthesizes solely for
 * elements it judges clickable, so tapping an inert backdrop area could fail
 * to dismiss the menu at all. `pointerdown` fires for mouse and touch alike,
 * and fires strictly before `mousedown` on the browsers that still emit it,
 * so switching changes nothing about when a mouse click dismisses.
 */
export function useDismissOnOutside(open: boolean, onDismiss: () => void, refs: React.RefObject<HTMLElement | null>[]): void {
  useEffect(() => {
    if (!open) return

    const handlePointerDownOutside = (e: PointerEvent) => {
      const target = e.target as Node
      if (refs.every((ref) => ref.current && !ref.current.contains(target))) {
        onDismiss()
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss()
    }

    document.addEventListener('pointerdown', handlePointerDownOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDownOutside)
      document.removeEventListener('keydown', handleEscape)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onDismiss/refs identity churn every render at both call sites; only `open` should retrigger this
  }, [open])
}
