// Admin/Worker access control credentials (src/store/authStore.ts,
// src/lib/auth/). A DEDICATED store, deliberately not fields tacked onto
// settingsStore — even though settingsStore is already a synced singleton
// and adding fields there would skip the triple registration below.
//
// The reason is how a 'singleton' sync unit merges (see
// src/lib/sync/diff.ts / merge.ts): a change to ANY field replaces the
// WHOLE stored object, and whichever op reaches the server last wins,
// regardless of which fields it actually changed. If this lived in
// settingsStore, a tablet that went offline before the admin password was
// ever set on it, then later (still offline) had its shop phone number
// edited, would push a settings-singleton upsert built from ITS stale copy
// — one with adminPasswordHash still null — on reconnect. If that push
// lands after the real password-set op, it silently erases the shop's
// admin password on every device. Splitting security into its own
// singleton means an unrelated settings edit can never carry a stale
// credential along with it.
//
// adminDeviceId/adminUsername inherit that exact same hazard, now living
// alongside lanToken/lanTokenRequired in this one singleton: a device that
// goes offline before it sees a binding op, then (still offline) regenerates
// the LAN token, pushes a stale `security` object with adminDeviceId
// missing — if that push lands after the real binding op, it silently
// un-binds the shop, and every device can attempt admin sign-in again. This
// is accepted rather than engineered around (e.g. a separate sync unit per
// field): it fails OPEN — nobody is locked out, binding just resets to
// "unclaimed" — which is the safe direction for a small shop on a trusted
// LAN, not a hostile one.
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { getStorageAdapter } from '../lib/storageAdapter'

interface Security {
  /** PBKDF2 hash (src/lib/auth/password.ts); null = no admin password has
   *  ever been set on this shop's data (first-run state). */
  adminPasswordHash: string | null
  /** Display name for the admin account — a label, not a credential.
   *  Signing in only ever asks for the password (src/store/authStore.ts's
   *  signInAdmin); this is shown back so the account reads as a personal
   *  one ("Signing in as {{username}}") instead of an anonymous shared
   *  secret. null on an existing shop that hasn't set one yet, or before
   *  any admin account exists. */
  adminUsername: string | null
  /** The one device (src/lib/deviceId.ts's getDeviceId()) allowed to sign
   *  in as admin — set automatically by whichever device first creates the
   *  admin password (src/store/authStore.ts's createAdminPassword), or
   *  lazily claimed by whichever device first signs in successfully on an
   *  existing shop upgrading from before this field existed. null/undefined
   *  ("unbound") means any device may attempt — see src/components/auth/
   *  LockScreen.tsx's canUseAdminHere. Rebindable only by restoring a JSON
   *  backup (src/lib/auth/adminDeviceBinding.ts), the shop's recovery path
   *  if this device is lost. Every check against this field must be
   *  falsy-based (`!adminDeviceId`), never `=== null`: a device that
   *  persisted security-store before this field existed rehydrates with it
   *  `undefined` (zustand's persist merge is a shallow merge, so an old
   *  blob's missing key is never backfilled from defaultSecurity below). */
  adminDeviceId: string | null
  /** Shared secret for the LAN sync server's optional token gate (see
   *  server/syncServer.ts). Generated once, shown/regenerated in Settings. */
  lanToken: string | null
  /** Whether the LAN sync server actually demands lanToken. Starts false so
   *  shipping this feature never locks out an already-paired device — see
   *  src/lib/sync/hostConfig.ts's resolveAuthToken(). */
  lanTokenRequired: boolean
}

interface SecurityStore {
  security: Security
  setAdminPasswordHash: (hash: string) => void
  setAdminUsername: (username: string | null) => void
  setAdminDeviceId: (deviceId: string | null) => void
  setLanToken: (token: string | null) => void
  setLanTokenRequired: (required: boolean) => void
}

const defaultSecurity: Security = {
  adminPasswordHash: null,
  adminUsername: null,
  adminDeviceId: null,
  lanToken: null,
  lanTokenRequired: false,
}

export const useSecurityStore = create<SecurityStore>()(
  persist(
    (set) => ({
      security: defaultSecurity,
      setAdminPasswordHash: (hash) => set((s) => ({ security: { ...s.security, adminPasswordHash: hash } })),
      setAdminUsername: (username) => set((s) => ({ security: { ...s.security, adminUsername: username } })),
      setAdminDeviceId: (deviceId) => set((s) => ({ security: { ...s.security, adminDeviceId: deviceId } })),
      setLanToken: (token) => set((s) => ({ security: { ...s.security, lanToken: token } })),
      setLanTokenRequired: (required) => set((s) => ({ security: { ...s.security, lanTokenRequired: required } })),
    }),
    { name: 'security-store', storage: createJSONStorage(getStorageAdapter) }
  )
)
