// What this device remembers about who is signed in, and the rules for
// whether that memory may be honoured on the next launch.
//
// Deliberately pure and store-free (the three impure helpers at the bottom
// touch storageAdapter and nothing else), because this project's Vitest runs
// with environment: 'node' and no React Testing Library — a decision made in
// a module like this one is the only kind that can actually be tested. See
// src/lib/__tests__/storedSession.test.ts.
//
// WHAT CHANGED, AND WHY IT MATTERS: this key used to hold the bare string
// 'worker' and nothing else, because Admin sessions were memory-only by
// design — they ended when the app closed. The shop asked for the ordinary
// behaviour instead: sign in once, stay signed in until you deliberately
// switch account. So the marker now records the mode AND which account, and
// Admin survives a restart.
//
// The honest consequence: this is NOT a credential. It is a memory that a
// credential was checked. Anyone with the SQLite file or devtools open can
// write {"mode":"admin"} into it, and the app will believe them. That is the
// accepted price of staying signed in, not an oversight — the same threat
// model src/lib/auth/password.ts already states for the password hash. What
// still holds: the stored username must name an account that actually exists
// in the synced shop data (so a forged name is refused, and renaming the
// admin account signs out every device that resumed under the old one), and
// every danger-zone action still re-asks for the password through
// PasswordPromptHost. The blast radius is "can see", not "can destroy".
import { storageAdapter } from '../storageAdapter'
import { DEVICE_LOCAL_KEYS } from '../storageKeys'
import { normalizeUsername } from './username'

/** `v` is bumped only if this shape changes incompatibly; an older build
 *  ignores a marker it doesn't recognize rather than misreading it. */
export interface StoredSession {
  v: 1
  mode: 'admin' | 'worker'
  /** The account that was signed in with, in the shop's own capitalization.
   *  null for the one-tap "Continue as worker" (no credential was checked),
   *  and for a legacy shop whose adminUsername was never set. */
  username: string | null
}

/** The account facts resolution needs, lifted out of securityStore so this
 *  module imports no store. */
export interface KnownAccounts {
  adminUsername: string | null
  adminPasswordHash: string | null
  workerUsername: string | null
  workerPasswordHash: string | null
}

export interface ResolvedSession {
  /** What the app should boot into. null means "show the login screen". */
  mode: 'admin' | 'worker' | null
  /** True when the marker on disk names an identity that is provably dead
   *  and should be deleted. Never true merely because we couldn't honour it
   *  right now — see resolveStoredSession. */
  clearMarker: boolean
}

/**
 * Reads a raw marker. Returns null for anything unrecognized — never throws.
 *
 * The bare string 'worker' is the pre-versioning format and MUST keep
 * parsing: every shop tablet already in the field has exactly that on disk,
 * and a regression here silently signs all of them out on upgrade.
 */
export function parseStoredSession(raw: string | null): StoredSession | null {
  if (!raw) return null
  if (raw === 'worker') return { v: 1, mode: 'worker', username: null }

  try {
    const parsed = JSON.parse(raw)
    if (parsed?.v !== 1) return null
    if (parsed.mode !== 'admin' && parsed.mode !== 'worker') return null
    return {
      v: 1,
      mode: parsed.mode,
      username: typeof parsed.username === 'string' && parsed.username.trim() ? parsed.username : null,
    }
  } catch {
    return null
  }
}

export function serializeStoredSession(session: StoredSession): string {
  return JSON.stringify(session)
}

/**
 * The boot decision: given what's on disk and what accounts the shop has,
 * what should this device open into?
 *
 * The two roles fail in opposite directions, on purpose:
 *
 * - **Worker fails OPEN.** A worker marker is honoured even if its username
 *   no longer matches any account. Refusing would grant nothing — "Continue
 *   as worker" sits one unauthenticated tap away on the very screen we'd
 *   bounce to — while breaking the sticky-tablet property this key exists
 *   for.
 *
 * - **Admin fails CLOSED, in two different ways.** A name that doesn't match
 *   the shop's admin account is a dead identity: refuse AND delete, which is
 *   what makes renaming the admin account a working way to sign every device
 *   out. But "the shop has no admin account visible at all" is NOT dead — on
 *   a cold follower, security-store is legitimately empty for the first
 *   seconds of every launch (precisely why App.tsx starts sync above the
 *   login-screen early return). Refuse for now, KEEP the marker, and let
 *   authStore's resume watcher honour it the moment sync delivers the
 *   account. Deleting here instead would demand a password on every restart
 *   of every follower — i.e. "stay signed in" would work only on the host.
 */
export function resolveStoredSession(raw: string | null, accounts: KnownAccounts): ResolvedSession {
  const stored = parseStoredSession(raw)
  // Unreadable, absent, or written by a newer version than this build
  // understands. Never delete it: a downgrade must not destroy the marker a
  // newer build is relying on.
  if (!stored) return { mode: null, clearMarker: false }

  if (stored.mode === 'worker') return { mode: 'worker', clearMarker: false }

  // The hash, not the username, is what proves an admin account exists — a
  // legacy shop can have a password with no name attached.
  if (!accounts.adminPasswordHash) return { mode: null, clearMarker: false }

  if (normalizeUsername(accounts.adminUsername) === normalizeUsername(stored.username)) {
    return { mode: 'admin', clearMarker: false }
  }
  return { mode: null, clearMarker: true }
}

/**
 * Raw marker for this device, or null.
 *
 * The try/catch is load-bearing and must not be dropped: src/store/
 * stockMovementStore.ts imports currentMode() from authStore, which drags
 * authStore's module-load-time read of this function into Vitest's plain-node
 * environment, where `localStorage` is a ReferenceError rather than merely
 * absent.
 */
export function readStoredSessionRaw(): string | null {
  try {
    return storageAdapter.getItem(DEVICE_LOCAL_KEYS.authMode)
  } catch {
    return null
  }
}

export function writeStoredSession(session: StoredSession): void {
  storageAdapter.setItem(DEVICE_LOCAL_KEYS.authMode, serializeStoredSession(session))
}

/** The delete counterpart this key never had — which is why the old "Sign
 *  out" (a bare window.location.reload) was a no-op for Worker mode: the
 *  marker survived the reload and put the device straight back in. */
export function clearStoredSession(): void {
  storageAdapter.removeItem(DEVICE_LOCAL_KEYS.authMode)
}
