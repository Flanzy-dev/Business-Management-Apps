import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Theme = 'dark' | 'light' | 'system'

interface ThemeState {
  theme: Theme
  setTheme: (theme: Theme) => void
  getEffectiveTheme: () => 'dark' | 'light'
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'dark',

      setTheme: (theme) => {
        set({ theme })
        applyTheme(theme)
      },

      getEffectiveTheme: () => {
        const { theme } = get()
        if (theme === 'system') {
          return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
        }
        return theme
      },
    }),
    {
      name: 'surya-baru-theme',
      onRehydrateStorage: () => (state) => {
        if (state) {
          applyTheme(state.theme)
        }
      },
    }
  )
)

function applyTheme(theme: Theme) {
  const root = document.documentElement
  const effectiveTheme = theme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
    : theme

  if (effectiveTheme === 'light') {
    root.classList.add('light')
  } else {
    root.classList.remove('light')
  }
}

// Listen for system theme changes
if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
    const store = useThemeStore.getState()
    if (store.theme === 'system') {
      applyTheme('system')
    }
  })
}
