// Backoff for POST /api/login, the server-side twin of
// src/lib/auth/loginThrottle.ts.
//
// Why a second implementation rather than reusing that one: the client
// throttle is per-device and stored in that device's own localStorage, which
// is exactly right for the lock screen (one device's typos must not lock out
// another device's admin) and exactly useless here. /api/login is reachable
// by anything on the shop's WiFi, and an attacker driving it in a loop never
// runs the renderer's code at all — it would simply skip the client throttle.
// This one is keyed by source address and lives in the host's memory.
//
// PBKDF2 at 210k iterations is itself the first line of defense (~10-40ms of
// native CPU per guess here — far faster than the renderer's pure-JS
// derivation, hence the need for this). The schedule below turns a
// brute-force loop into a wait that grows faster than the guesses do.
//
// Memory-only on purpose: a host restart clears every lockout. That fails
// OPEN, matching src/store/securityStore.ts's stated posture for a small
// shop on a trusted LAN — the cost is an attacker who can restart the shop's
// PC, who has already won by other means.

/** Wrong guesses this many or fewer produce no delay — typos happen, and the
 *  shop floor should never feel a lockout for one. Matches
 *  src/lib/auth/loginThrottle.ts's FREE_ATTEMPTS. */
const FREE_ATTEMPTS = 3
const BASE_DELAY_MS = 2_000
const MAX_DELAY_MS = 5 * 60_000
/** An entry idle this long is dropped, so the map can't grow without bound
 *  on a long-running host that sees many source addresses. Comfortably
 *  longer than MAX_DELAY_MS, so expiry can never cut a lockout short. */
const ENTRY_TTL_MS = 30 * 60_000
/** Hard ceiling on tracked addresses. Reached only under a spoofed-source
 *  flood; evicting the least recently seen keeps this bounded without ever
 *  dropping the entry for whoever is actively being throttled. */
const MAX_ENTRIES = 1_000

interface Attempt {
  failCount: number
  lockedUntil: number | null
  lastSeen: number
}

export interface RateLimitCheck {
  allowed: boolean
  /** Only meaningful when allowed is false. */
  retryAfterMs: number
}

export interface LoginRateLimiter {
  check(key: string, now?: number): RateLimitCheck
  recordFailure(key: string, now?: number): void
  recordSuccess(key: string): void
}

function delayForFailCount(failCount: number): number {
  if (failCount <= FREE_ATTEMPTS) return 0
  return Math.min(BASE_DELAY_MS * 2 ** (failCount - FREE_ATTEMPTS - 1), MAX_DELAY_MS)
}

/**
 * A fresh limiter. Created per server instance rather than as module state
 * so two servers in one process (as the tests build) can't share a lockout,
 * and so a test can drive `now` explicitly instead of sleeping.
 */
export function createLoginRateLimiter(): LoginRateLimiter {
  const attempts = new Map<string, Attempt>()

  function sweep(now: number): void {
    for (const [key, entry] of attempts) {
      if (now - entry.lastSeen > ENTRY_TTL_MS) attempts.delete(key)
    }
    if (attempts.size <= MAX_ENTRIES) return
    const oldestFirst = [...attempts.entries()].sort((a, b) => a[1].lastSeen - b[1].lastSeen)
    for (const [key] of oldestFirst.slice(0, attempts.size - MAX_ENTRIES)) attempts.delete(key)
  }

  return {
    check(key, now = Date.now()) {
      const entry = attempts.get(key)
      if (entry?.lockedUntil && entry.lockedUntil > now) {
        return { allowed: false, retryAfterMs: entry.lockedUntil - now }
      }
      return { allowed: true, retryAfterMs: 0 }
    },

    recordFailure(key, now = Date.now()) {
      const failCount = (attempts.get(key)?.failCount ?? 0) + 1
      const delay = delayForFailCount(failCount)
      attempts.set(key, { failCount, lockedUntil: delay > 0 ? now + delay : null, lastSeen: now })
      sweep(now)
    },

    recordSuccess(key) {
      attempts.delete(key)
    },
  }
}
