import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMode } from '../store/authStore'
import { canAccessRoute } from '../lib/auth/permissions'
import { ROUTES } from '../lib/routes'
import { useShortcutsHelpStore } from '../store/shortcutsHelpStore'

// path -> shortcut key, derived from routes.ts's ROUTES rather than a
// hand-kept switch, so a shortcut can't point at a path that doesn't exist.
const SHORTCUT_ROUTES = new Map(ROUTES.filter((r) => r.shortcut).map((r) => [r.shortcut!, r.path]))

/** Is the keydown's target a field the user is actively typing into? */
function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement
}

export function useKeyboardShortcuts() {
  const navigate = useNavigate()
  const mode = useMode()

  useEffect(() => {
    // Silently does nothing for a route Worker mode can't reach, rather
    // than navigating and letting RequireAdmin bounce it back — a bounce
    // would flash the restricted page's route change in history.
    const goTo = (path: string) => {
      if (canAccessRoute(mode, path)) navigate(path)
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + key shortcuts fire even while a field is focused: Dialog
      // auto-focuses its first input on open (src/components/ui/Dialog.tsx),
      // so a cashier in an open order couldn't otherwise Ctrl+N the next one
      // without clicking out first — and that's the app's most-repeated action.
      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase()

        if (key === 'n') {
          e.preventDefault()
          goTo('/work-orders?new=1')
          return
        }

        // Ctrl+K opens the GlobalSearch palette — handled in Layout.tsx, which
        // owns the palette's open state; no case here so the two don't fight.
        if (key === 'k') return

        const path = SHORTCUT_ROUTES.get(key)
        if (path) {
          e.preventDefault()
          goTo(path)
        }
        return
      }

      // Unmodified keys — suppressed while typing.
      if (isTypingTarget(e.target)) return

      // "?" (Shift+/) opens the keyboard-shortcuts cheatsheet — the app's only
      // discoverability surface for the shortcuts above.
      if (e.key === '?') {
        e.preventDefault()
        useShortcutsHelpStore.getState().setOpen(true)
      }

      // Escape to close modals (handled by individual components)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigate, mode])
}
