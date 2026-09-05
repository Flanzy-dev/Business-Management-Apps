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
// The shop's two accounts (admin and worker) both live here for that same
// reason. They are what server/syncServer.ts's POST /api/login verifies
// against — the host reads this very row back out through
// server/shopAccounts.ts — so a device can join the shop by signing in with
// a name and password instead of being told a generated LAN token.
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
  /** Login name for the admin account. Was once a display label only —
   *  it is now a real credential: src/store/authStore.ts's signIn matches on
   *  it, server/syncServer.ts's POST /api/login matches on it, and
   *  src/lib/auth/storedSession.ts uses it to decide whether a saved Admin
   *  session may resume (so renaming it signs every device out). null on an
   *  existing shop that never set one, or before any admin account exists —
   *  a shop in that state can still sign in, matching a marker or a login
   *  that carries no username either. */
  adminUsername: string | null
  /** PBKDF2 hash for the shop-floor account, or null when the shop hasn't
   *  made one. Optional by design: Worker mode is still enterable with one
   *  tap and no password (src/store/authStore.ts's enterWorkerMode), which
   *  is what a busy shop floor needs. This credential exists for the case
   *  one tap can't cover — proving to ANOTHER device that you belong to
   *  this shop, at server/syncServer.ts's POST /api/login, so a new tablet
   *  can pair without being handed an admin password. */
  workerPasswordHash: string | null
  /** Login name for the worker account — unlike adminUsername (historically
   *  a label only), this one is a real credential: POST /api/login matches
   *  on it, and so does src/store/authStore.ts's signIn. */
  workerUsername: string | null
  /** Historically "the ONE device allowed to sign in as admin", enforced by
   *  authStore's signInAdmin and hidden behind the lock screen's own gate.
   *  That enforcement is GONE: the shop asked for an account that works from
   *  any device, which is the exact opposite of a single-device binding.
   *
   *  The field is kept, still written by whichever device creates the admin
   *  account, because src/lib/auth/adminDeviceBinding.ts's backup-restore
   *  recovery path and its tests are built on it, and because "which device
   *  set this up" stays useful to show. Nothing reads it as a gate any more
   *  — if you reintroduce one, note that every check must be falsy-based
   *  (`!adminDeviceId`), never `=== null`: a device that persisted this
   *  store before the field existed rehydrates with it `undefined` (zustand's
   *  persist merge is shallow, so an old blob's missing key is never
   *  backfilled from defaultSecurity below). */
  adminDeviceId: string | null
  /** Shared secret for the LAN sync server's optional token gate (see
   *  server/syncServer.ts) — the ADMIN-tier one: it also authorizes
   *  `security-store` writes (see validateOpBatch's admin-only gate on that
   *  entity), so this is the token every currently-paired device already
   *  holds and the only one shown/regenerated in Settings. Generated once,
   *  at admin-account creation. */
  lanToken: string | null
  /** The WORKER-tier LAN token — grants the same ordinary sync access as
   *  `lanToken` (reading/writing shop data, so a worker-paired tablet keeps
   *  working normally) but is deliberately refused for `security-store`
   *  writes at the server gate. Exists so `POST /api/login`'s worker branch
   *  can hand a joining device SOMETHING, without that something being able
   *  to rewrite the admin account — see server/syncServer.ts's
   *  validateOpBatch. Never shown or regenerated in Settings: it only ever
   *  moves through /api/login, the same way the single token used to for a
   *  worker-initiated pairing. Minted by
   *  src/lib/auth/ensureWorkerLanToken.ts the moment a worker account
   *  exists, mirroring how `lanToken` is guaranteed by ensureLanToken.ts. */
  workerLanToken: string | null
  /** Whether the LAN sync server actually demands lanToken. Starts false so
   *  shipping this feature never locks out an already-paired device — see
   *  src/lib/sync/hostConfig.ts's resolveAuthToken(). */
  lanTokenRequired: boolean
  /** PBKDF2 hash of the shop's admin recovery code (src/lib/auth/recoveryCode.ts),
   *  which src/components/auth/ForgotPasswordForm.tsx verifies to let someone
   *  set a new admin password without knowing the old one. The plaintext
   *  code itself is never stored anywhere — only this hash, same threat
   *  model as adminPasswordHash above.
   *
   *  Null on a shop that predates recovery codes, or (per the falsy-vs-null
   *  warning on adminDeviceId above) on a device that persisted this store
   *  before the field existed, which rehydrates with it `undefined` — every
   *  read must be falsy-based (`!adminRecoveryCodeHash`), never `=== null`.
   *  src/lib/auth/ensureAdminRecoveryCode.ts backfills it on the next admin
   *  launch. */
  adminRecoveryCodeHash: string | null
}

interface SecurityStore {
  security: Security
  setAdminPasswordHash: (hash: string) => void
  setAdminUsername: (username: string | null) => void
  /** Sets both halves of the worker account in one write, or clears it with
   *  (null, null). One setter rather than two because a username without a
   *  hash (or the reverse) is not a state the shop should ever be in — a
   *  half-made account would be invisible to server/shopAccounts.ts (which
   *  skips any account missing either half) while still looking set in
   *  Settings. */
  setWorkerAccount: (username: string | null, passwordHash: string | null) => void
  setAdminDeviceId: (deviceId: string | null) => void
  setLanToken: (token: string | null) => void
  setWorkerLanToken: (token: string | null) => void
  setLanTokenRequired: (required: boolean) => void
  setAdminRecoveryCodeHash: (hash: string | null) => void
}

const defaultSecurity: Security = {
  adminPasswordHash: null,
  adminUsername: null,
  workerPasswordHash: null,
  workerUsername: null,
  adminDeviceId: null,
  lanToken: null,
  workerLanToken: null,
  lanTokenRequired: false,
  adminRecoveryCodeHash: null,
}

export const useSecurityStore = create<SecurityStore>()(
  persist(
    (set) => ({
      security: defaultSecurity,
      setAdminPasswordHash: (hash) => set((s) => ({ security: { ...s.security, adminPasswordHash: hash } })),
      setAdminUsername: (username) => set((s) => ({ security: { ...s.security, adminUsername: username } })),
      setWorkerAccount: (username, passwordHash) =>
        set((s) => ({ security: { ...s.security, workerUsername: username, workerPasswordHash: passwordHash } })),
      setAdminDeviceId: (deviceId) => set((s) => ({ security: { ...s.security, adminDeviceId: deviceId } })),
      setLanToken: (token) => set((s) => ({ security: { ...s.security, lanToken: token } })),
      setWorkerLanToken: (token) => set((s) => ({ security: { ...s.security, workerLanToken: token } })),
      setLanTokenRequired: (required) => set((s) => ({ security: { ...s.security, lanTokenRequired: required } })),
      setAdminRecoveryCodeHash: (hash) => set((s) => ({ security: { ...s.security, adminRecoveryCodeHash: hash } })),
    }),
    { name: 'security-store', storage: createJSONStorage(getStorageAdapter) }
  )
)
