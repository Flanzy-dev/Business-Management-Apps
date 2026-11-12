// Small related modules kept in one file, one section each with its original notes: toastStore,
// confirmStore, passwordPromptStore, elevateDialogStore, recoveryCodeStore, shortcutsHelpStore.
import { create } from 'zustand'

// ---- toastStore ----

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
  /** Stop the countdown (pointer over the toast, or focus inside it). */
  pause: () => void
  /** Restart the countdown with whatever time was left (at least MIN_RESUME_MS). */
  resume: () => void
}

/** How long each tone stays up. A confirmation is read at a glance (DESIGN_SYSTEM.md
 *  §8's 3.5s); a warning or error has to be read *and understood*, so it
 *  stays longer — an error that vanishes before it is read is worse than none. */
export const TOAST_DURATION_MS: Record<ToastTone, number> = {
  neutral: 3500,
  success: 3500,
  warning: 6000,
  danger: 8000,
}

/** After a pause, never dismiss in less than this — the reader just moved away. */
const MIN_RESUME_MS = 1500

let dismissTimer: ReturnType<typeof setTimeout> | null = null
let remainingMs = 0
let startedAt = 0

function clearTimer() {
  if (dismissTimer) {
    clearTimeout(dismissTimer)
    dismissTimer = null
  }
}

export const useToastStore = create<ToastState>((set, get) => {
  const arm = (ms: number) => {
    clearTimer()
    remainingMs = ms
    startedAt = Date.now()
    dismissTimer = setTimeout(() => {
      dismissTimer = null
      set({ toast: null })
    }, ms)
  }

  return {
    toast: null,
    show: (toast) => {
      // Debounce/replace-on-repeat (DESIGN_SYSTEM.md §7): a new toast while one is
      // showing restarts the timer rather than stacking.
      set({ toast })
      arm(TOAST_DURATION_MS[toast.tone])
    },
    dismiss: () => {
      clearTimer()
      set({ toast: null })
    },
    pause: () => {
      if (!dismissTimer) return
      clearTimer()
      remainingMs = Math.max(0, remainingMs - (Date.now() - startedAt))
    },
    resume: () => {
      // Nothing to resume if there is no toast, or the countdown is already running.
      if (!get().toast || dismissTimer) return
      arm(Math.max(remainingMs, MIN_RESUME_MS))
    },
  }
})

// ---- confirmStore ----

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

// ---- passwordPromptStore ----

// Imperative admin re-auth prompt — same pattern as src/store/uiStores.ts
// (a themed replacement for window.confirm), one level stricter: this one
// resolves true only once the admin password has actually been re-verified,
// not just acknowledged. See src/lib/auth/requireAdminPassword.ts for the
// promise-returning wrapper call sites actually use, and
// src/components/auth/PasswordPromptHost.tsx (mounted in Layout) for where
// verification happens.

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

// ---- elevateDialogStore ----

// Open state for src/components/auth/AdminElevateDialog.tsx — mirrors
// src/store/uiStores.ts's shape exactly. A tiny store rather than
// local Layout state for the same reason that one is a store and not a
// useState: src/hooks/useModeSwitch.ts (the sidebar double-click) is the
// thing that needs to open it, and it has no view of Layout's own state.
//
// Deliberately not a Promise-returning request()/close(ok) pair like
// src/store/uiStores.ts — the elevate gesture has exactly one
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

// ---- recoveryCodeStore ----

// A tiny, deliberately NOT persisted store for one job: getting a freshly
// minted admin recovery code (src/lib/auth/recoveryCode.ts) in front of the
// user exactly once, no matter which of several very different places
// mints it.
//
// The plaintext code is never stored anywhere else — src/store/securityStore.ts
// only ever holds its PBKDF2 hash — so this store is the code's ONLY
// lifetime: it exists from the moment it's minted until "I've saved it" is
// clicked, and is gone the instant that happens (or the app restarts).
//
// Why a dedicated store instead of local component state: every path that
// mints a code either signs the device in (createAdminPassword,
// resetAdminPasswordWithRecoveryCode — both of which unmount LoginScreen the
// moment they succeed) or runs deep inside Settings
// (RecoveryCodeSection). None of those call sites is in a position to also
// own a "show this dialog" flag that survives across that unmount/remount —
// so instead they all just call show(code), and one dialog
// (src/components/auth/RecoveryCodeDialog.tsx), mounted once in
// src/components/layout/Layout.tsx alongside ToastHost/ConfirmHost/PasswordPromptHost,
// reacts to whatever lands here regardless of which screen is up when it does.

interface RecoveryCodeStore {
  pendingCode: string | null
  show: (code: string) => void
  dismiss: () => void
}

export const useRecoveryCodeStore = create<RecoveryCodeStore>((set) => ({
  pendingCode: null,
  show: (code) => set({ pendingCode: code }),
  dismiss: () => set({ pendingCode: null }),
}))

// ---- shortcutsHelpStore ----

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
