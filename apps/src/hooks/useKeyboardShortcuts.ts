import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMode } from '../store/authStore'
import { canAccessRoute } from '../lib/auth/permissions'
import { ROUTES } from '../lib/app/routes'
import { resolveShortcut } from '../lib/app/navigation'
import { useShortcutsHelpStore } from '../store/uiStores'

// path -> shortcut key, derived from routes.ts's ROUTES rather than a
// hand-kept switch, so a shortcut can't point at a path that doesn't exist.
const SHORTCUT_ROUTES = new Map(ROUTES.filter((r) => r.shortcut).map((r) => [r.shortcut!, r.path]))

/** Is the keydown's target a field the user is actively typing into? */
function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement
}

/** App-wide shortcuts. The rules for which key does what, and when a key is
 *  ignored, live in src/lib/app/navigation.ts. `onSearch` opens Layout's
 *  GlobalSearch palette, whose open state Layout owns. */
export function useKeyboardShortcuts({ onSearch }: { onSearch: () => void }) {
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
      const action = resolveShortcut(
        {
          key: e.key,
          mod: e.ctrlKey || e.metaKey,
          typing: isTypingTarget(e.target),
          dialogOpen: !!document.querySelector('[aria-modal="true"]'),
        },
        SHORTCUT_ROUTES,
      )
      if (!action) return
      e.preventDefault()
      if (action.type === 'newOrder') goTo('/work-orders?new=1')
      else if (action.type === 'search') onSearch()
      else if (action.type === 'route') goTo(action.path)
      else useShortcutsHelpStore.getState().setOpen(true)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigate, mode, onSearch])
}
