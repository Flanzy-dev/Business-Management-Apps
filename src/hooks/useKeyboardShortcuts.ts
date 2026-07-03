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
            e.preventDefault()
            navigate('/work-orders')
            break
          case 'd':
            e.preventDefault()
            navigate('/')
            break
          case 'k':
            e.preventDefault()
            // Focus search if available, or go to customers
            const searchInput = document.querySelector('input[type="text"][placeholder*="Search"]') as HTMLInputElement
            if (searchInput) {
              searchInput.focus()
            } else {
              navigate('/customers')
            }
            break
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
