// Imperative admin re-auth prompt — same pattern as src/store/confirmStore.ts
// (a themed replacement for window.confirm), one level stricter: this one
// resolves true only once the admin password has actually been re-verified,
// not just acknowledged. See src/lib/auth/requireAdminPassword.ts for the
// promise-returning wrapper call sites actually use, and
// src/components/auth/PasswordPromptHost.tsx (mounted in Layout) for where
// verification happens.
import { create } from 'zustand'

interface PasswordPromptOptions {
  title: string
  /** Why we're asking, in the user's language — shown under the title. */
  message: string
  confirmLabel?: string
}

interface PasswordPromptState {
  pending: (PasswordPromptOptions & { resolve: (ok: boolean) => void }) | null
  request: (options: PasswordPromptOptions) => Promise<boolean>
  /** Called by the host once verification has run (true) or the dialog was
   *  dismissed/cancelled (false). Not meant for other callers. */
  close: (ok: boolean) => void
}

export const usePasswordPromptStore = create<PasswordPromptState>((set, get) => ({
  pending: null,
  request: (options) => {
    return new Promise<boolean>((resolve) => {
      set({ pending: { ...options, resolve } })
    })
  },
  close: (ok) => {
    const pending = get().pending
    set({ pending: null })
    pending?.resolve(ok)
  },
}))
