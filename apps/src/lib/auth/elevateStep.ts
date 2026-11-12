// The derived-step rule shared by every screen that has to decide, live,
// between "sign in" and "there is no account yet, create one" —
// LoginScreen and AdminElevateDialog both need it and both need to agree.
//
// Pure and store-free so Vitest (environment: 'node', no DOM) can exercise
// it directly — the two React components built on it are not otherwise
// testable at all.

export type AuthStep = 'signIn' | 'create'

/**
 * `override` always wins when set — that's how a screen remembers an
 * explicit choice (LoginScreen's restore link, or a create form the user
 * has started typing into) across a re-render. Absent an override, the
 * answer is derived from whether the shop has an admin password at all.
 *
 * MUST be derived, never seeded into useState even lazily. A cold follower
 * (a device that just paired, or is waiting on its first sync) boots with
 * adminPasswordHash === null for the first seconds of every launch — see
 * src/lib/auth/storedSession.ts's header and src/store/authStore.ts's
 * resume watcher, which both exist because of exactly this window. A step
 * seeded once at mount would pin itself on "create the account" and never
 * flip when the shop's real account arrives a moment later — and worse,
 * the person looking at that screen would go ahead and create a SECOND
 * admin account, which then collides with the real one the instant sync
 * lands. Calling this fresh on every render, with `override` as the only
 * memory, is what avoids that.
 */
export function resolveAuthStep(adminPasswordHash: string | null, override: AuthStep | null): AuthStep {
  return override ?? (adminPasswordHash ? 'signIn' : 'create')
}
