// Live Admin/Worker session state. Deliberately NOT a zustand `persist`
// store: what survives a restart is decided by rules too specific for a
// blanket rehydrate, and they live in src/lib/auth/storedSession.ts — read
// that file's header first, it explains what the marker is and is not.
//
// Both modes now persist. This store used to give them opposite lifetimes
// (Worker sticky, Admin memory-only, dying the moment the app closed); the
// shop asked for the ordinary behaviour instead — sign in once, stay signed
// in until you deliberately pick Switch account. There is no idle timeout
// any more either; src/lib/auth/useIdleLock.ts was deleted with this change.
//
// The one rule that keeps that honest: ONLY A PASSED CREDENTIAL CHECK WRITES
// AN ADMIN MARKER. signIn, signInAsAdmin, createAdminPassword, and
// resetAdminPasswordWithRecoveryCode each verify something before they
// persist one — a recovery code counts as a credential precisely because it
// is one: src/lib/auth/recoveryCode.ts's code is a ~100-bit secret, hashed
// the same way an admin password is, and knowing it is what src/lib/auth
// treats as proof of being the shop's admin when the password itself is
// forgotten. (enterWorkerMode is the one exception,
// and a deliberate one: it writes a WORKER marker having verified nothing —
// safe only because "Continue as worker" sits one unauthenticated tap away
// on the login screen regardless, so persisting that choice grants nothing a
// fresh tap wouldn't already grant.) There is no longer any way into Admin
// that verifies nothing — enterAdminWithoutPassword, which used to be
// exactly that, is deleted; see src/hooks/useModeSwitch.ts and
// src/components/auth/AdminElevateDialog.tsx for what replaced it.
//
// mode: null now means "signed out" — App.tsx renders the login screen for
// it. That covers a genuinely fresh device, one that pressed Switch account,
// and a follower whose shop data hasn't arrived yet (see the resume watcher
// at the bottom of this file).
import { create } from 'zustand'
import { getDeviceId } from '../lib/deviceId'
import { hashPassword, verifyPassword } from '../lib/auth/password'
import { checkLoginThrottle, recordLoginFailure, recordLoginSuccess, verifyAgainstHash } from '../lib/auth/loginThrottle'
import { generateShopToken } from '../lib/auth/shopToken'
import { generateRecoveryCode, normalizeRecoveryCode } from '../lib/auth/recoveryCode'
import { adminUsernameMatches, normalizeUsername } from '../lib/auth/username'
import { useRecoveryCodeStore } from './recoveryCodeStore'
import type { Mode } from '../lib/auth/permissions'
import {
  clearStoredSession,
  readStoredSessionRaw,
  resolveStoredSession,
  writeStoredSession,
  type KnownAccounts,
} from '../lib/auth/storedSession'
import { useSecurityStore } from './securityStore'

/**
 * The live session's mode, where `null` is the third real state: "signed
 * out" — no session on this device (App.tsx renders the login screen for
 * it). That covers a fresh install, a device that pressed Switch account,
 * and a follower whose shop data hasn't arrived yet.
 *
 * Deliberately NOT named `Mode`: src/lib/auth/permissions.ts owns that name for
 * the non-null `'admin' | 'worker'` a permission decision is made about. Two
 * same-named types differing only in nullability, in one domain, is a trap — an
 * importer reaching for `Mode` and landing on the nullable one gets code that
 * type-checks and then treats "locked" as "worker". Use currentMode()/useMode()
 * below to cross from this type to that one.
 */
type SessionMode = 'admin' | 'worker' | null

/** What a username+password attempt produced. `role` is null unless `ok`. */
interface SignInResult {
  ok: boolean
  role: Mode | null
  retryAfterMs: number
}

interface AuthStore {
  mode: SessionMode
  /** One-tap entry, no password, and it persists like any other session.
   *
   *  Kept password-free on purpose even though the shop now has a worker
   *  account with a real credential (src/store/securityStore.ts's
   *  workerUsername/workerPasswordHash): those exist so a NEW device can
   *  prove it belongs to this shop, not to put a login between a technician
   *  and a work order every morning. See signIn below. */
  enterWorkerMode: () => void
  /**
   * Sign in with one of the shop's two accounts. Matches `username`
   * case-insensitively against the admin account first, then the worker
   * account, and verifies `password` against whichever matched — so one
   * form serves both, and which account you hold decides what you get,
   * rather than the button you pressed.
   *
   * Either role persists: the device resumes into that same account on its
   * next launch and stays there until someone picks Switch account. See
   * src/lib/auth/storedSession.ts for what is actually written and for the
   * rules that decide whether it may be honoured later.
   *
   * Shares the one device-local throttle with confirmAdminPassword and
   * signInAsAdmin — see src/lib/auth/loginThrottle.ts — so guesses cost the
   * same here as at the re-auth dialog and the elevate dialog. Never throws.
   */
  signIn: (username: string, password: string) => Promise<SignInResult>
  /** Password-only admin verification, for the re-auth dialog
   *  (src/components/auth/PasswordPromptHost.tsx) — the shop is confirming
   *  an action it's already inside, not identifying itself (every caller
   *  sits behind <RequireAdmin>, so a session already exists), which is why
   *  this asks for nothing but the password and why, unlike signInAsAdmin
   *  below, it deliberately does NOT touch the session marker or `mode` —
   *  see its implementation.
   *
   *  `ok` is false on a wrong password, when no admin password has been set
   *  yet, or when this device is in a login-throttle cooldown — see
   *  src/lib/auth/loginThrottle.ts. `retryAfterMs > 0` distinguishes the
   *  throttle case from an ordinary wrong password, so the caller can show a
   *  different message. Never throws. */
  confirmAdminPassword: (password: string) => Promise<{ ok: boolean; retryAfterMs: number }>
  /** Hashes and stores the shop's admin username and password, records this
   *  device in adminDeviceId (a record of where the account was made, no
   *  longer a restriction — see signInAsAdmin), makes sure the shop has a
   *  LAN token for /api/login to hand out and a recovery code for
   *  ForgotPasswordForm to fall back on (both minted here rather than left
   *  for someone to remember to press a button for later — see this
   *  function's body), then signs in as admin immediately so the same tap
   *  that creates the account also unlocks with it.
   *
   *  Not just first-run any more: src/components/auth/SignUpForm.tsx's admin
   *  branch calls this too, after already confirming the CURRENT admin
   *  password itself (confirmAdminPassword) — this function has no opinion
   *  on who may call it or when, same as it always has been. */
  createAdminPassword: (username: string, password: string) => Promise<void>
  /**
   * Username + password admin verification, for the double-click elevate
   * dialog (src/components/auth/AdminElevateDialog.tsx) — the ONE remaining
   * function this store exposes that identifies a caller rather than merely
   * confirming an already-open session, which is why it takes a username at
   * all where confirmAdminPassword doesn't.
   *
   * Checks ONLY the admin candidate, never the worker one — worker
   * credentials must not be able to elevate, and checking a single named
   * account (rather than delegating to signIn's admin-then-worker search) is
   * what makes that true by construction instead of by a follow-up check
   * someone could forget to add. The username match itself is
   * src/lib/auth/username.ts's adminUsernameMatches, which is lenient only
   * when the shop has no adminUsername on record at all (a real, if rare,
   * state — see that file's header) so a legacy shop is never permanently
   * locked out of Admin.
   *
   * On success this DOES persist (writes an admin session marker and sets
   * `mode`), unlike confirmAdminPassword — this is genuinely how the device
   * becomes Admin, not a re-confirmation of a mode it's already in.
   * `retryAfterMs`/never-throws semantics match confirmAdminPassword and
   * share the same device-local throttle.
   */
  signInAsAdmin: (username: string, password: string) => Promise<{ ok: boolean; retryAfterMs: number }>
  /**
   * LoginScreen's "Forgot password?" path
   * (src/components/auth/ForgotPasswordForm.tsx) — sets a NEW admin password
   * after verifying `code` against security.adminRecoveryCodeHash instead of
   * the old password, which by definition the caller doesn't have.
   *
   * A valid code IS a passed credential check (see this file's header
   * invariant above), so on success this DOES persist an admin marker and
   * set `mode`, the same as signInAsAdmin — this is genuinely how the device
   * becomes Admin, not a re-confirmation of a mode it's already in.
   *
   * Mints and stores a FRESH recovery code before returning, pushed to
   * src/store/recoveryCodeStore.ts for RecoveryCodeDialog to show — the code
   * that was just spent must never work a second time, so a shop is never
   * left mid-reset with no way back in if this device is lost next.
   *
   * Shares the one device-local throttle with every other credential check
   * here (loginThrottle.ts), so code guesses cost exactly what password
   * guesses cost. Never throws. `ok` is false on a wrong/malformed code,
   * when the shop has no recovery code set at all, or while throttled. */
  resetAdminPasswordWithRecoveryCode: (code: string, newPassword: string) => Promise<{ ok: boolean; retryAfterMs: number }>
  /** "Switch account" (profile menu) — forgets this device's session and
   *  returns to the login screen so someone else can sign in. Replaces both
   *  the old Lock (which kept the marker, so it never really signed anyone
   *  out) and the old Sign out (a bare window.location.reload that never
   *  cleared the marker either, making it a no-op for Worker mode). */
  signOut: () => void
}

/** The account facts resolveStoredSession needs, read fresh every time — the
 *  shop's accounts arrive by sync and can change under a running app. */
function knownAccounts(): KnownAccounts {
  const { adminUsername, adminPasswordHash, workerUsername, workerPasswordHash } =
    useSecurityStore.getState().security
  return { adminUsername, adminPasswordHash, workerUsername, workerPasswordHash }
}

/** Resolves what this device should boot into, and honours a marker that
 *  resolution found to be dead (a renamed admin account) by deleting it. */
function resumeSession(): Mode | null {
  const { mode, clearMarker } = resolveStoredSession(readStoredSessionRaw(), knownAccounts())
  if (clearMarker) {
    try {
      clearStoredSession()
    } catch {
      // Storage is failing and StorageErrorBanner already says so. Refusing
      // the session is the part that matters, and that already happened.
    }
  }
  return mode
}

/** A failed guess's bookkeeping — count it, then report whatever throttle
 *  window that just opened. Shared by every rejection path below (a wrong
 *  admin password, and a wrong elevate username) so a wrong username costs
 *  EXACTLY what a wrong password costs. Without that, the throttle would be
 *  a free username oracle: try names for nothing, only real password
 *  guesses would count against the budget. */
function recordFailureAndThrottle(): { ok: false; retryAfterMs: number } {
  recordLoginFailure()
  const after = checkLoginThrottle()
  return { ok: false, retryAfterMs: after.allowed ? 0 : after.retryAfterMs }
}

/**
 * The actual admin-password check, throttled, shared by confirmAdminPassword
 * and signInAsAdmin below — neither of those two functions does its own
 * verifyPassword call, so there is exactly one place this can go wrong.
 * Deliberately does NOT touch the session marker or `mode`: that decision
 * differs between the two callers (see AuthStore's doc comments on each),
 * so it stays with them.
 */
async function verifyAdminPassword(password: string): Promise<{ ok: boolean; retryAfterMs: number }> {
  const throttle = checkLoginThrottle()
  if (!throttle.allowed) return { ok: false, retryAfterMs: throttle.retryAfterMs }

  const security = useSecurityStore.getState().security
  if (!security.adminPasswordHash) return { ok: false, retryAfterMs: 0 }

  if (!(await verifyPassword(password, security.adminPasswordHash))) {
    return recordFailureAndThrottle()
  }

  recordLoginSuccess()
  // Still claimed when unset, purely as a record of where the account was
  // set up (and for src/lib/auth/adminDeviceBinding.ts's restore path).
  // Nothing gates on it — see securityStore.ts's adminDeviceId doc.
  if (!security.adminDeviceId) useSecurityStore.getState().setAdminDeviceId(getDeviceId())
  return { ok: true, retryAfterMs: 0 }
}

export const useAuthStore = create<AuthStore>((set) => ({
  // Computed once at module load, same timing as src/lib/deviceId.ts's
  // cached read — by the time anything imports this store, storageAdapter
  // is already backed by either the real Electron bridge or localStorage.
  //
  // This also reads useSecurityStore, which works only because ESM evaluates
  // that module (and zustand's SYNCHRONOUS rehydrate through storageAdapter)
  // before this create() call runs. True today. If storageAdapter ever went
  // async, admin resume would silently degrade to "always show the login
  // screen" — the resume watcher below is what would put it right a tick
  // later, so the failure would show as a flicker rather than a lockout.
  mode: resumeSession(),

  enterWorkerMode: () => {
    // The one-tap entry: no credential was checked, so no username is
    // recorded. It still persists — a shop tablet not re-asking every
    // morning is the whole point of it.
    writeStoredSession({ v: 1, mode: 'worker', username: null })
    set({ mode: 'worker' })
  },

  signIn: async (username, password) => {
    const throttle = checkLoginThrottle()
    if (!throttle.allowed) return { ok: false, role: null, retryAfterMs: throttle.retryAfterMs }

    const security = useSecurityStore.getState().security
    const wanted = username.trim().toLowerCase()
    // Admin first, so a shop that (against advice) gave both accounts the
    // same name gets the more capable one — matching how POST /api/login
    // orders them in server/shopAccounts.ts.
    //
    // usernameMatches is role-specific, not a shared candidate.username ===
    // wanted check, because the two roles have different rules for what
    // counts as a match:
    //  - admin uses adminUsernameMatches (src/lib/auth/username.ts), the
    //    SAME lenient rule signInAsAdmin already applies — a legacy shop can
    //    have a real admin password with no adminUsername ever recorded (see
    //    that field doc in securityStore.ts), and a strict comparison here
    //    used to silently skip that candidate no matter what was typed,
    //    making such a shop password permanently unable to sign in through
    //    this form (the elevate dialog signInAsAdmin never had this bug —
    //    only this form did, which is what made it easy to miss).
    //  - worker has no such legacy state to be lenient about: setWorkerAccount
    //    always writes both halves together, so a worker candidate
    //    username is never null while its hash is set (or vice versa) —
    //    plain exact-match is correct and sufficient.
    const candidates: { role: Mode; username: string | null; hash: string | null; usernameMatches: boolean }[] = [
      {
        role: 'admin',
        username: security.adminUsername,
        hash: security.adminPasswordHash,
        usernameMatches: adminUsernameMatches(security.adminUsername, username),
      },
      {
        role: 'worker',
        username: security.workerUsername,
        hash: security.workerPasswordHash,
        usernameMatches: !!security.workerUsername && normalizeUsername(security.workerUsername) === wanted,
      },
    ]

    for (const candidate of candidates) {
      if (!candidate.hash || !candidate.usernameMatches) continue
      if (!(await verifyPassword(password, candidate.hash))) continue

      recordLoginSuccess()
      // Both roles persist now. The account's OWN username is stored rather
      // than what was typed, so the marker carries the shop's capitalization
      // and resolves cleanly on the next launch.
      writeStoredSession({ v: 1, mode: candidate.role, username: candidate.username })
      set({ mode: candidate.role })
      return { ok: true, role: candidate.role, retryAfterMs: 0 }
    }

    // recordFailureAndThrottle's {ok:false, retryAfterMs} shape is missing
    // `role` — signIn is the one function here whose result carries which
    // account matched, so it's the one caller that has to add that field
    // back rather than returning the helper's result directly.
    return { role: null, ...recordFailureAndThrottle() }
  },

  confirmAdminPassword: async (password) => {
    // No device-binding gate. It used to refuse here whenever
    // security.adminDeviceId named a different device, which is exactly the
    // restriction the shop asked to remove: one account, usable from any
    // device that syncs. What replaces it is the pairing step — a device
    // only holds this shop's data at all once it authenticated at
    // server/syncServer.ts's /api/login — plus the throttle inside
    // verifyAdminPassword.
    //
    // No marker write and no set({mode}) either, unlike signInAsAdmin —
    // every caller here already sits behind <RequireAdmin>, so `mode` is
    // already 'admin' and a marker already exists; this call is confirming
    // that session, not creating one.
    return verifyAdminPassword(password)
  },

  createAdminPassword: async (username, password) => {
    const hash = await hashPassword(password)
    const security = useSecurityStore.getState()
    security.setAdminPasswordHash(hash)
    security.setAdminUsername(username)
    // Separate set() calls (one sync op each) rather than one combined
    // write — deliberate, not a race: src/lib/sync/merge.ts's singleton
    // merge applies ops in server-assigned seq order and this device's own
    // outbox preserves call order, so whichever op reaches another device
    // last always wins there too.
    security.setAdminDeviceId(getDeviceId())

    // Every shop gets a LAN token the moment it has an account, so a second
    // device signing in at /api/login always leaves holding one. Generated
    // here rather than waiting for someone to press Generate in Settings,
    // because that button is easy to never find — and a device paired
    // before the token existed would then be missing the very thing that
    // keeps it working if "Require token on LAN" is switched on later.
    //
    // Note what is deliberately NOT done: lanTokenRequired stays false.
    // Turning it on here would 401 any device already paired against this
    // shop before the account existed, and a 401'd device cannot sync down
    // the token that would fix it — a deadlock. Requiring it stays a
    // deliberate, confirmed choice in Settings > Security.
    if (!useSecurityStore.getState().security.lanToken) {
      security.setLanToken(generateShopToken())
    }

    // Same reasoning as the LAN token immediately above, for the same
    // hazard: an account with no recovery code is one forgotten password
    // away from the shop being locked out for good. Always mints a fresh
    // one here rather than only backfilling (contrast ensureLanToken's
    // if-missing check) — this path also runs when SignUpForm's admin
    // branch REPLACES an existing admin account, and the old account's
    // recovery code must not go on working for a password that no longer
    // exists.
    const recoveryCode = generateRecoveryCode()
    security.setAdminRecoveryCodeHash(await hashPassword(normalizeRecoveryCode(recoveryCode)))
    useRecoveryCodeStore.getState().show(recoveryCode)

    writeStoredSession({ v: 1, mode: 'admin', username: username.trim() })
    set({ mode: 'admin' })
  },

  signInAsAdmin: async (username, password) => {
    const throttle = checkLoginThrottle()
    if (!throttle.allowed) return { ok: false, retryAfterMs: throttle.retryAfterMs }

    const security = useSecurityStore.getState().security
    // Nothing to sign in to yet — the caller (AdminElevateDialog) should be
    // showing its create-account branch instead, per resolveAuthStep. Kept
    // here too so this function can never grant Admin without a hash to
    // check against, no matter what UI state got it here.
    if (!security.adminPasswordHash) return { ok: false, retryAfterMs: 0 }

    // Checked BEFORE the password, and costs exactly what a wrong password
    // costs (recordFailureAndThrottle, not a free pass) — a wrong username
    // must not be distinguishable from a wrong password by whether it
    // consumed throttle budget. adminUsernameMatches is lenient only when
    // this shop has no adminUsername on record (see that function's doc) —
    // otherwise it's an exact, case/whitespace-insensitive match.
    if (!adminUsernameMatches(security.adminUsername, username)) {
      return recordFailureAndThrottle()
    }

    const result = await verifyAdminPassword(password)
    if (!result.ok) return result

    // This IS the elevation, unlike confirmAdminPassword: persist the
    // account's own stored username (not the typed string, so the marker
    // carries the shop's capitalization — same rule as signIn), and set
    // mode so the caller doesn't need a second step.
    writeStoredSession({ v: 1, mode: 'admin', username: security.adminUsername })
    set({ mode: 'admin' })
    return result
  },

  resetAdminPasswordWithRecoveryCode: async (code, newPassword) => {
    const security = useSecurityStore.getState().security
    // Nothing to check the code against — mirrors signInAsAdmin's identical
    // guard for "no admin account yet", and for the same reason: never grant
    // Admin without something on record to have verified against, no matter
    // what UI state got here (ForgotPasswordForm only shows its entry link
    // when this hash is truthy, but that's a UI nicety, not the gate).
    if (!security.adminRecoveryCodeHash) return { ok: false, retryAfterMs: 0 }

    // verifyAgainstHash owns the full throttle-then-verify-then-record
    // sequence (loginThrottle.ts) — the same helper RestoreRecoveryFlow uses
    // for its own backup-embedded-password check, so a code guess and a
    // password guess share one accounting.
    const result = await verifyAgainstHash(normalizeRecoveryCode(code), security.adminRecoveryCodeHash)
    if (!result.ok) return result

    useSecurityStore.getState().setAdminPasswordHash(await hashPassword(newPassword))

    // The code that was just spent must never verify again. A fresh one
    // replaces it immediately, same as createAdminPassword mints one for a
    // brand-new account — a shop must never sit with a valid password and no
    // way back in if this device is then lost.
    const nextRecoveryCode = generateRecoveryCode()
    useSecurityStore.getState().setAdminRecoveryCodeHash(await hashPassword(normalizeRecoveryCode(nextRecoveryCode)))
    useRecoveryCodeStore.getState().show(nextRecoveryCode)

    // This IS the elevation (see signInAsAdmin's identical comment on this
    // exact line): persist the account's own stored username, unchanged — a
    // password reset changes the password, never the account's identity.
    writeStoredSession({ v: 1, mode: 'admin', username: security.adminUsername })
    set({ mode: 'admin' })
    return result
  },

  signOut: () => {
    try {
      clearStoredSession()
    } catch {
      // Leave anyway. The user asked to sign out, StorageErrorBanner is
      // already reporting that writes are failing, and the worst case is a
      // restart resuming the session — strictly better than refusing to
      // sign out at all.
    }
    disposeSessionResumeWatcher()
    set({ mode: null })
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
 * least-privileged mode — a signed-out device (mode null) must never be
 * attributed or authorized as admin. Both readers share this so the rule has exactly
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

// --- session resume watcher ------------------------------------------
// The cold-follower fix. A device that follows another host boots with an
// empty security-store — the shop's accounts are still in flight — so
// resolveStoredSession can't yet tell a legitimate admin marker from a
// forged one and correctly refuses (keeping the marker; see its doc).
// Without this, that device would demand a password on every single launch,
// and "stay signed in" would work only on the host.
//
// Not module-level side effects: App.tsx calls attach() from the same mount
// effect that starts sync, which keeps this file import-safe for
// stockMovementStore's node-environment tests.
let resumeUnsubscribe: (() => void) | null = null

export function attachSessionResumeWatcher(): void {
  if (resumeUnsubscribe) return
  // Already signed in — nothing to resume, and subscribing would only risk
  // the override this function refuses to make below.
  if (useAuthStore.getState().mode !== null) return

  resumeUnsubscribe = useSecurityStore.subscribe(() => {
    // Never override a live session. Someone who tapped "Continue as worker"
    // while sync was still in flight must not be yanked into Admin a second
    // later by a marker they didn't act on.
    if (useAuthStore.getState().mode !== null) {
      disposeSessionResumeWatcher()
      return
    }
    const mode = resumeSession()
    if (mode) {
      useAuthStore.setState({ mode })
      disposeSessionResumeWatcher()
    }
  })
}

function disposeSessionResumeWatcher(): void {
  resumeUnsubscribe?.()
  resumeUnsubscribe = null
}
