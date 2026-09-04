import { create } from 'zustand'

// Open state for the ShortcutsHelp cheatsheet. A tiny store rather than local
// state because two unrelated things toggle it: the '?' key (handled in
// src/hooks/useKeyboardShortcuts.ts, which owns no UI) and the profile
// dropdown menu item in Layout.
interface ShortcutsHelpState {
  open: boolean
  setOpen: (open: boolean) => void
}

export const useShortcutsHelpStore = create<ShortcutsHelpState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}))
