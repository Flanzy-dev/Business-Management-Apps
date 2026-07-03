import { create } from 'zustand'

type ToastTone = 'neutral' | 'success' | 'danger' | 'warning'

interface ToastContent {
  tone: ToastTone
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
}

interface ToastState {
  toast: ToastContent | null
  show: (toast: ToastContent) => void
  dismiss: () => void
}

const AUTO_DISMISS_MS = 3500
let dismissTimer: ReturnType<typeof setTimeout> | null = null

export const useToastStore = create<ToastState>((set) => ({
  toast: null,
  show: (toast) => {
    // Debounce/replace-on-repeat (DESIGN.md §8): a new toast while one is
    // showing restarts the timer rather than stacking.
    if (dismissTimer) clearTimeout(dismissTimer)
    set({ toast })
    dismissTimer = setTimeout(() => {
      set({ toast: null })
      dismissTimer = null
    }, AUTO_DISMISS_MS)
  },
  dismiss: () => {
    if (dismissTimer) {
      clearTimeout(dismissTimer)
      dismissTimer = null
    }
    set({ toast: null })
  },
}))
