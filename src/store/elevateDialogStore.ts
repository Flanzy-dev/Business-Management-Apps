import { create } from 'zustand'

// Open state for src/components/auth/AdminElevateDialog.tsx — mirrors
// src/store/shortcutsHelpStore.ts's shape exactly. A tiny store rather than
// local Layout state for the same reason that one is a store and not a
// useState: src/hooks/useModeSwitch.ts (the sidebar double-click) is the
// thing that needs to open it, and it has no view of Layout's own state.
//
// Deliberately not a Promise-returning request()/close(ok) pair like
// src/store/passwordPromptStore.ts — the elevate gesture has exactly one
// call site and its only outcome is a toast, so there is nothing for a
// caller to await. See AdminElevateDialog's header for the rest of why this
// is a separate dialog rather than an extension of PasswordPromptHost.
interface ElevateDialogState {
  open: boolean
  setOpen: (open: boolean) => void
}

export const useElevateDialogStore = create<ElevateDialogState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}))
