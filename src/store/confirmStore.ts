import { create } from 'zustand'

interface ConfirmOptions {
  title: string
  message: string
  confirmLabel?: string
  tone?: 'danger' | 'primary'
}

interface ConfirmState {
  pending: (ConfirmOptions & { onConfirm: () => void }) | null
  /** Themed replacement for window.confirm: shows a ConfirmDialog (hosted in
   *  Layout) and runs onConfirm only if the user confirms. */
  request: (options: ConfirmOptions, onConfirm: () => void) => void
  close: () => void
}

export const useConfirmStore = create<ConfirmState>((set) => ({
  pending: null,
  request: (options, onConfirm) => set({ pending: { ...options, onConfirm } }),
  close: () => set({ pending: null }),
}))
