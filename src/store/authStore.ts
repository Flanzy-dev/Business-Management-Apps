// Live Admin/Worker session state. Deliberately NOT a zustand `persist`
// store — the two modes need opposite lifetimes: Worker mode is sticky
// across restarts (a shop tablet shouldn't re-ask every morning), Admin
// mode is memory-only and ends the moment the app closes. That split is
// handled by hand: only the string 'worker' is ever written to the
// device-local 'auth-mode' key (src/lib/storageKeys.ts's DEVICE_LOCAL_KEYS,
// same read/write-straight-through-storageAdapter pattern as
// src/lib/deviceId.ts and src/lib/sync/hostConfig.ts) — 'admin' never
// touches disk, so there's nothing for a restart to resume it from.
//
// mode: null means "no mode chosen yet on this device" — App.tsx renders
// the lock screen for that case, same as it would for a device that has
// never had Worker mode explicitly entered.
import { create } from 'zustand'
import { storageAdapter } from '../lib/storageAdapter'
import { DEVICE_LOCAL_KEYS } from '../lib/storageKeys'
import { getDeviceId } from '../lib/deviceId'
import { hashPassword, verifyPassword } from '../lib/auth/password'
import { checkLoginThrottle, recordLoginFailure, recordLoginSuccess } from '../lib/auth/loginThrottle'
import type { Mode } from '../lib/auth/permissions'
import { useSecurityStore } from './securityStore'

/**
 * The live session's mode, where `null` is the third real state: "no mode
 * chosen yet on this device" (App.tsx renders the lock screen for it).
 *
 * Deliberately NOT named `Mode`: src/lib/auth/permissions.ts owns that name for
 * the non-null `'admin' | 'worker'` a permission decision is made about. Two
 * same-named types differing only in nullability, in one domain, is a trap — an
 * importer reaching for `Mode` and landing on the nullable one gets code that
 * type-checks and then treats "locked" as "worker". Use currentMode()/useMode()
 * below to cross from this type to that one.
 */
type SessionMode = 'admin' | 'worker' | null

interface AuthStore {
  mode: SessionMode
  /** One-click entry, no password. Also the target of the idle timeout and
   *  of closing the app on a device that was in Worker mode — sticky. */
  enterWorkerMode: () => void
  /** `ok` is false on a wrong password, when no admin password has been set
   *  yet (the lock screen should be offering "create a password" in that
   *  case, not this), when this device is in a login-throttle cooldown — see
   *  src/lib/auth/loginThrottle.ts — or when the admin account is bound to a
   *  different device (src/store/securityStore.ts's adminDeviceId; see
   *  src/components/auth/LockScreen.tsx, which hides the Admin option
   *  entirely in that case, so this branch normally isn't UI-reachable — it
   *  exists so the store itself never accepts a verify it shouldn't, not
   *  just the screen in front of it). `retryAfterMs > 0` distinguishes the
   *  throttle case from an ordinary wrong password, so the caller can show a
   *  different message. Never throws. */
  signInAdmin: (password: string) => Promise<{ ok: boolean; retryAfterMs: number }>
  /** First-run only: hashes and stores the shop's admin password and
   *  username, binds this device as the only one that may ever sign in as
   *  admin (src/store/securityStore.ts's adminDeviceId — see
   *  src/lib/auth/adminDeviceBinding.ts for the only other way that binding
   *  can change, a backup restore), then signs in as admin immediately so
   *  the same tap that creates the account also unlocks with it. */
  createAdminPassword: (username: string, password: string) => Promise<void>
  /** First-run only: enters Admin on a shop that has never set an admin
   *  password — the one path into Admin that verifies nothing, used by the
   *  double-click-to-switch gesture in Layout when there is simply no
   *  password to prompt for. Refuses the moment a hash exists (or the admin
   *  account is bound to another device), so it can never become a password
   *  bypass. Like signInAdmin it only sets the in-memory `mode` — nothing is
   *  written to disk, so a restart still lands on the lock screen. Returns
   *  whether it elevated. */
  enterAdminWithoutPassword: () => boolean
  /** Manual "Lock" (profile menu) — returns to the lock screen immediately.
   *  Does not touch the sticky Worker marker: a device that was in Worker
   *  mode still resumes Worker on its next launch, same as before Lock was
   *  pressed. */
  lock: () => void
  /** Idle-timeout path — functionally identical to enterWorkerMode, kept as
   *  its own name because the caller (useIdleLock) has a specific reason
   *  for the transition worth reading in a stack trace or in Layout. */
  dropToWorker: () => void
}

function readStickyWorkerMode(): boolean {
  try {
    return storageAdapter.getItem(DEVICE_LOCAL_KEYS.authMode) === 'worker'
  } catch {
    // No localStorage in this environment — same graceful-degradation
    // getStorageAdapter() documents for persisted stores. This one isn't a
    // persist store, so it has to guard itself: it's read eagerly at module
    // load (the `mode:` initializer below), and stockMovementStore.ts now
    // imports currentMode() from this module, which pulls this file into
    // Vitest's plain-node test environment (no DOM) well outside Electron/a
    // browser, where localStorage always exists.
    return false
  }
}

function writeStickyWorkerMode(): void {
  storageAdapter.setItem(DEVICE_LOCAL_KEYS.authMode, 'worker')
}

export const useAuthStore = create<AuthStore>((set) => ({
  // Computed once at module load, same timing as src/lib/deviceId.ts's
  // cached read — by the time anything imports this store, storageAdapter
  // is already backed by either the real Electron bridge or localStorage.
  mode: readStickyWorkerMode() ? 'worker' : null,

  enterWorkerMode: () => {
    writeStickyWorkerMode()
    set({ mode: 'worker' })
  },

  signInAdmin: async (password) => {
    const throttle = checkLoginThrottle()
    if (!throttle.allowed) return { ok: false, retryAfterMs: throttle.retryAfterMs }

    const security = useSecurityStore.getState().security
    if (!security.adminPasswordHash) return { ok: false, retryAfterMs: 0 }

    // Single-admin-device gate. Not a wrong-password case, so it never
    // touches the throttle — a device that can never succeed here shouldn't
    // also be able to grind down its own (or anyone else's) attempt budget.
    // Unreachable via the UI today (LockScreen hides the Admin option
    // entirely once this is true), kept here anyway so the store can't be
    // driven into an admin session it shouldn't grant by some future caller
    // that skips that check.
    if (security.adminDeviceId && security.adminDeviceId !== getDeviceId()) {
      return { ok: false, retryAfterMs: 0 }
    }

    const ok = await verifyPassword(password, security.adminPasswordHash)
    if (ok) {
      recordLoginSuccess()
      // Lazy migration: an existing shop that had a password before
      // adminDeviceId existed has nothing bound yet. Whichever device signs
      // in successfully first after upgrading claims it — no manual step,
      // and safe because we already know this device just proved it knows
      // the password.
      if (!security.adminDeviceId) useSecurityStore.getState().setAdminDeviceId(getDeviceId())
      set({ mode: 'admin' })
      return { ok: true, retryAfterMs: 0 }
    }

    recordLoginFailure()
    const after = checkLoginThrottle()
    return { ok: false, retryAfterMs: after.allowed ? 0 : after.retryAfterMs }
  },

  createAdminPassword: async (username, password) => {
    const hash = await hashPassword(password)
    const security = useSecurityStore.getState()
    security.setAdminPasswordHash(hash)
    security.setAdminUsername(username)
    // Three separate set() calls (three sync ops) rather than one combined
    // write — deliberate, not a race: src/lib/sync/merge.ts's singleton
    // merge applies ops in server-assigned seq order and this device's own
    // outbox preserves call order, so whichever op reaches another device
    // last always wins there too. Binds this device as the only one that
    // may ever sign in as admin from here on.
    security.setAdminDeviceId(getDeviceId())
    set({ mode: 'admin' })
  },

  enterAdminWithoutPassword: () => {
    const { adminPasswordHash, adminDeviceId } = useSecurityStore.getState().security
    // A password exists — not the first-run case; the caller must go through
    // signInAdmin (via the password prompt) instead.
    if (adminPasswordHash) return false
    // Admin already bound to another device (a backup restore can set this
    // with no password) — mirror signInAdmin's device gate.
    if (adminDeviceId && adminDeviceId !== getDeviceId()) return false
    set({ mode: 'admin' })
    return true
  },

  lock: () => {
    set({ mode: null })
  },

  dropToWorker: () => {
    writeStickyWorkerMode()
    set({ mode: 'worker' })
  },
}))

/** Ergonomic selector for the common case — re-renders only when the
 *  admin/not-admin boundary actually changes, not on every mode value. */
export function useIsAdmin(): boolean {
  return useAuthStore((s) => s.mode === 'admin')
}

/**
 * The one place a SessionMode becomes a permission-subject Mode: anything other
 * than an active admin session is treated as Worker, because Worker is the
 * least-privileged mode — a locked device (mode null) must never be attributed
 * or authorized as admin. Both readers below share this so the rule has exactly
 * one spelling.
 */
function asPermissionMode(mode: SessionMode): Mode {
  return mode === 'admin' ? 'admin' : 'worker'
}

/** Reactive read for components deciding what to show — pair with the
 *  predicates in src/lib/auth/permissions.ts (canSeeCostAndProfit, etc.). */
export function useMode(): Mode {
  return useAuthStore((s) => asPermissionMode(s.mode))
}

/** Non-hook twin of useMode, for code outside React — e.g. stockMovementStore
 *  stamping who recorded a stock change, or a page's event handler writing an
 *  activity-log entry. */
export function currentMode(): Mode {
  return asPermissionMode(useAuthStore.getState().mode)
}
