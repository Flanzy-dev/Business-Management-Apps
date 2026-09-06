import { useRef } from 'react'
import type { MouseEvent, PointerEvent } from 'react'
import { isTouchClick, readPointerKind, type PointerKind } from './pointerType'

// Double-clicks landing on these never open the row's editor: action menus,
// links, form controls, and anything explicitly opting out via
// data-no-row-edit (e.g. a name that already opens its own view dialog).
const INTERACTIVE_SELECTOR = 'button, a, input, select, textarea, [data-no-row-edit]'

/**
 * Spread onto a table row or card so double-clicking it opens that record's
 * edit dialog — a shortcut alongside the existing "..." menu > Edit action.
 * Clicks on buttons/links/inputs inside the row (e.g. the actions menu
 * trigger) are ignored so they keep their own single-click behavior.
 */
export function rowEditOnDoubleClick(onEdit: () => void) {
  return {
    onDoubleClick: (event: MouseEvent<HTMLElement>) => {
      if ((event.target as HTMLElement).closest(INTERACTIVE_SELECTOR)) return
      // A double-click also selects a word — clear it so the dialog doesn't
      // open on top of a highlighted cell.
      window.getSelection()?.removeAllRanges()
      onEdit()
    },
  }
}

const DOUBLE_CLICK_WINDOW_MS = 250

/**
 * For expandable rows/cards where a single click toggles expand and a double
 * click should open the edit dialog instead. Naively combining a plain
 * onClick with rowEditOnDoubleClick fires onClick twice during every
 * double-click (the browser emits two click events before dblclick),
 * toggling expand open-then-closed as a visible flicker right before the
 * edit dialog opens. This hook defers the single-click toggle until it's
 * clear a second click on the same row isn't coming, so a double-click never
 * touches expand state.
 *
 * On touch, the 250ms wait is pure dead latency — there's no hover, and a
 * double-TAP is unreliable anyway (many browsers treat it as a zoom gesture).
 * So a click positively identified as touch (src/lib/pointerType.ts's
 * isTouchClick) runs onToggleExpand immediately instead of deferring it. It
 * still arms the same timer, but as a SUPPRESSION flag whose timeout clears
 * the flag and runs nothing — skipping the timer entirely would reopen the
 * exact bug this hook exists to prevent: Chromium still synthesizes a
 * `dblclick` from two fast taps, and with no pending ref that second tap's
 * "already pending" guard below never fires, so a double-tap would toggle
 * expand and then ALSO open the editor. Arming a no-op timer keeps the
 * anti-double-fire invariant intact while paying zero perceived latency on
 * the visible action.
 */
export function useExpandOrEdit() {
  const pending = useRef<{ id: string; timer: ReturnType<typeof setTimeout> } | null>(null)
  const lastPointerDownKind = useRef<PointerKind | null>(null)

  return function handlers(id: string, onToggleExpand: () => void, onEdit: () => void) {
    return {
      onPointerDown: (event: PointerEvent<HTMLElement>) => {
        lastPointerDownKind.current = readPointerKind(event)
      },
      onClick: (event: MouseEvent<HTMLElement>) => {
        if ((event.target as HTMLElement).closest(INTERACTIVE_SELECTOR)) return
        if (pending.current?.id === id) return // 2nd click of this row's double-click — let onDoubleClick handle it

        if (isTouchClick(event.nativeEvent, lastPointerDownKind.current)) {
          pending.current = {
            id,
            timer: setTimeout(() => {
              pending.current = null
            }, DOUBLE_CLICK_WINDOW_MS),
          }
          onToggleExpand()
          return
        }

        pending.current = {
          id,
          timer: setTimeout(() => {
            pending.current = null
            onToggleExpand()
          }, DOUBLE_CLICK_WINDOW_MS),
        }
      },
      onDoubleClick: (event: MouseEvent<HTMLElement>) => {
        if ((event.target as HTMLElement).closest(INTERACTIVE_SELECTOR)) return
        if (pending.current?.id === id) {
          clearTimeout(pending.current.timer)
          pending.current = null
        }
        window.getSelection()?.removeAllRanges()
        onEdit()
      },
    }
  }
}

/**
 * For a single element whose own click already does something (e.g. a tile's
 * tap-to-add) and whose double-click should do something else entirely. Same
 * defer-and-cancel shape as useExpandOrEdit, but for one element rather than a
 * keyed list of rows, and without useExpandOrEdit's "ignore clicks on nested
 * interactive children" rule — the element here typically *is* the button.
 *
 * Same touch fast-path as useExpandOrEdit, for the same reason: a click
 * identified as touch runs onClick immediately, still arming the timer as a
 * suppression-only flag so a synthesized dblclick from two fast taps can't
 * ALSO fire onDoubleClick on top of the already-run onClick. See that
 * function's doc for why skipping the timer entirely would be wrong.
 */
export function useClickOrDoubleClick() {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastPointerDownKind = useRef<PointerKind | null>(null)

  return function handlers(onClick: () => void, onDoubleClick: () => void) {
    return {
      onPointerDown: (event: PointerEvent<HTMLElement>) => {
        lastPointerDownKind.current = readPointerKind(event)
      },
      onClick: (event: MouseEvent<HTMLElement>) => {
        if (timer.current) return // 2nd click of a double-click — let onDoubleClick handle it

        if (isTouchClick(event.nativeEvent, lastPointerDownKind.current)) {
          timer.current = setTimeout(() => {
            timer.current = null
          }, DOUBLE_CLICK_WINDOW_MS)
          onClick()
          return
        }

        timer.current = setTimeout(() => {
          timer.current = null
          onClick()
        }, DOUBLE_CLICK_WINDOW_MS)
      },
      onDoubleClick: () => {
        if (timer.current) {
          clearTimeout(timer.current)
          timer.current = null
        }
        onDoubleClick()
      },
    }
  }
}
