import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export function useKeyboardShortcuts() {
  const navigate = useNavigate()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return
      }

      // Ctrl/Cmd + key shortcuts
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'n':
            // Opens the New Order dialog directly (same ?new=1 the "New Work
            // Order" sidebar button uses), not just the list — this is the
            // single most-repeated action in the app, so the shortcut should
            // save the extra click, not just the navigation.
            e.preventDefault()
            navigate('/work-orders?new=1')
            break
          case 'd':
            e.preventDefault()
            navigate('/')
            break
          // Ctrl+K opens the GlobalSearch palette — handled in Layout.tsx, which
          // owns the palette's open state; no case here so the two don't fight.
          case '1':
            e.preventDefault()
            navigate('/customers')
            break
          case '2':
            e.preventDefault()
            navigate('/vehicles')
            break
          case '3':
            e.preventDefault()
            navigate('/work-orders')
            break
          case '4':
            e.preventDefault()
            navigate('/inventory')
            break
          case '5':
            e.preventDefault()
            navigate('/reports')
            break
        }
      }

      // Escape to close modals (handled by individual components)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigate])
}
