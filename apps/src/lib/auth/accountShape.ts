// Whether the login screen should ask for a username at all — the shop has
// at most two accounts (src/store/securityStore.ts), and with exactly one of
// them there is nothing to disambiguate: the username field is asking a
// question with only one possible answer. src/components/auth/SignInForm.tsx
// and AdminElevateForm.tsx both need this and both need to agree, same
// reasoning as src/lib/auth/elevateStep.ts and username.ts.
//
// Pure and store-free so Vitest (environment: 'node', no DOM) can exercise
// it directly.

/** The account facts this decision needs, lifted out of securityStore so
 *  this module imports no store — same shape rule as storedSession.ts's
 *  KnownAccounts. */
export interface KnownAccounts {
  adminUsername: string | null
  adminPasswordHash: string | null
  workerUsername: string | null
  workerPasswordHash: string | null
}

/** The hash, not the username, is what proves an admin account exists — a
 *  legacy shop can have a password with no name attached (securityStore.ts's
 *  adminUsername doc; storedSession.ts's admin rule already applies this). */
export function hasAdminAccount(accounts: KnownAccounts): boolean {
  return !!accounts.adminPasswordHash
}

/** BOTH halves required, unlike admin. setWorkerAccount always writes the
 *  pair atomically (securityStore.ts's doc on it), so there is no legacy
 *  half-made worker to be lenient about — the same asymmetry
 *  server/shopAccounts.ts and authStore.ts's signIn candidates both encode. */
export function hasWorkerAccount(accounts: KnownAccounts): boolean {
  return !!accounts.workerUsername && !!accounts.workerPasswordHash
}

export type SignInFieldShape =
  /** 0 accounts, or 2 — the person has to say which one they hold. */
  | { kind: 'askUsername' }
  /** Exactly one account. Hide the username field and submit this string;
   *  it is the only name that could ever match. '' for a legacy admin with
   *  no adminUsername recorded — username.ts's adminUsernameMatches accepts
   *  that against a null stored name. */
  | { kind: 'passwordOnly'; username: string }

/**
 * Which shape the sign-in form should take, given the shop's current
 * accounts. MUST be called fresh on every render, never seeded into a
 * useState — same rule, and the same reason, as elevateStep.ts's
 * resolveAuthStep: a cold follower can be hydrated with the admin hash
 * present and the worker account not yet synced down, and the shape must be
 * free to flip from passwordOnly to askUsername the instant it does.
 */
export function signInFieldShape(accounts: KnownAccounts): SignInFieldShape {
  const admin = hasAdminAccount(accounts)
  const worker = hasWorkerAccount(accounts)
  if (admin === worker) return { kind: 'askUsername' } // both, or neither
  if (admin) return { kind: 'passwordOnly', username: accounts.adminUsername ?? '' }
  return { kind: 'passwordOnly', username: accounts.workerUsername! }
}
