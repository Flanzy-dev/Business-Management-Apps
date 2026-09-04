import { useRef } from 'react'
import type { MouseEvent } from 'react'

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
 */
export function useExpandOrEdit() {
  const pending = useRef<{ id: string; timer: ReturnType<typeof setTimeout> } | null>(null)

  return function handlers(id: string, onToggleExpand: () => void, onEdit: () => void) {
    return {
      onClick: (event: MouseEvent<HTMLElement>) => {
        if ((event.target as HTMLElement).closest(INTERACTIVE_SELECTOR)) return
        if (pending.current?.id === id) return // 2nd click of this row's double-click — let onDoubleClick handle it
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
 */
export function useClickOrDoubleClick() {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  return function handlers(onClick: () => void, onDoubleClick: () => void) {
    return {
      onClick: () => {
        if (timer.current) return // 2nd click of a double-click — let onDoubleClick handle it
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
