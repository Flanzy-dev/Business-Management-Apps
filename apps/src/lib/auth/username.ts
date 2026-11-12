// Shared username comparison — the one place "same username" gets decided,
// so the session marker (src/lib/auth/storedSession.ts) and the elevate
// credential check (src/store/authStore.ts's signInAsAdmin) can never
// silently disagree about what counts as a match. Both used to carry their
// own private copy of this rule; a fix or a leniency added to one and missed
// in the other would have been a real, hard-to-notice divergence between
// "which session survives a restart" and "who is allowed to elevate".
//
// Pure and store-free on purpose — this project's Vitest runs with
// environment: 'node' and no DOM, so a module like this is the only kind a
// test can exercise directly.

/** Case- and whitespace-insensitive normalization. `null` and `''` collapse
 *  to the same value, which is what lets a legacy shop — one whose
 *  adminUsername was never set — still match against an empty/absent typed
 *  name. See adminUsernameMatches for where that leniency is actually
 *  applied; this function alone doesn't decide policy, just equality. */
export function normalizeUsername(value: string | null): string {
  return (value ?? '').trim().toLowerCase()
}

/**
 * Whether `typed` names the shop's admin account.
 *
 * `adminUsername === null` matches ANYTHING typed, including an empty
 * string — deliberate, not an oversight. A shop can have a real admin
 * password with no username ever recorded (securityStore.ts's adminUsername
 * doc: "null on an existing shop that hasn't set one yet"), and until this
 * change that shop's ONLY door into Admin from another device was the
 * password-only elevate prompt — src/store/authStore.ts's signIn requires a
 * non-null username on every candidate and simply skips one that has none.
 * A strict match here would permanently brick such a shop's ability to
 * reach Admin at all. Once adminUsername IS set, the match is exact
 * (case/whitespace aside) — there is no reason to be lenient once a name
 * exists to check against.
 */
export function adminUsernameMatches(adminUsername: string | null, typed: string): boolean {
  if (!adminUsername) return true
  return normalizeUsername(adminUsername) === normalizeUsername(typed)
}

/**
 * Whether `typed` collides with the OTHER account's name — the rule that
 * keeps the shop's two accounts (admin, worker) from ever sharing a name.
 * Two accounts with the same username would make the second one permanently
 * unreachable, since src/store/authStore.ts's signIn always tries the admin
 * candidate first and stops there on a match.
 *
 * `otherUsername === null` (the other account doesn't exist, or was never
 * named) never collides — there is nothing to collide with. An empty
 * `typed` likewise never collides; that's `usernameRequired`'s job, not this
 * one's.
 *
 * Extracted from src/components/settings/WorkerAccountSection.tsx, which
 * used to hand-roll this exact `.trim().toLowerCase()` comparison inline —
 * now shared with src/lib/auth/signUpValidation.ts so the two can't drift on
 * what "taken" means.
 */
export function usernameTakenBy(typed: string, otherUsername: string | null): boolean {
  if (!otherUsername || !typed.trim()) return false
  return normalizeUsername(typed) === normalizeUsername(otherUsername)
}
