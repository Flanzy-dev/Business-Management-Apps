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
// src/components/Layout.tsx alongside ToastHost/ConfirmHost/PasswordPromptHost,
// reacts to whatever lands here regardless of which screen is up when it does.
import { create } from 'zustand'

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
