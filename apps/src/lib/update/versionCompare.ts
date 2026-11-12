// Compares this device's app version against a host's, as reported by
// GET /api/info (see server/syncServer.ts's handleInfo and
// src/lib/sync/client.ts's InfoResponse). Used only for the cosmetic
// "this device is behind/ahead of the shop's host" warning in
// SyncCard.tsx — never anything that gates data, so an 'unknown' result is
// always safe to render as nothing.

export type VersionRelation = 'same' | 'client-older' | 'client-newer' | 'unknown'

/** Splits "1.10.2" into [1, 10, 2]. Returns null for anything that isn't a
 *  dotted run of non-negative integers, so a malformed or unexpected string
 *  (a v-prefix, a pre-release suffix, empty, non-numeric) falls back to
 *  'unknown' rather than a wrong comparison. */
function parse(version: string): number[] | null {
  const parts = version.trim().split('.')
  if (parts.length === 0) return null
  const numbers = parts.map((p) => (/^\d+$/.test(p) ? Number(p) : NaN))
  return numbers.some(Number.isNaN) ? null : numbers
}

/**
 * `host` is `string | null | undefined` because both are real, silent
 * cases: `undefined` is a host running a build that predates the `version`
 * field on /api/info entirely (every host before this feature), and `null`
 * is a host that has the field but couldn't determine its own version. Both
 * — and any unparseable string — must produce 'unknown', which the caller
 * renders as no warning at all, rather than a false "behind" or "ahead".
 *
 * Compares numeric segments position by position (not string/lexicographic
 * comparison, which would wrongly rank "1.9.0" above "1.10.0"), and treats
 * a missing trailing segment as 0 (so "1.2" and "1.2.0" compare equal).
 */
export function compareAppVersions(client: string, host: string | null | undefined): VersionRelation {
  if (host == null) return 'unknown'
  const clientParts = parse(client)
  const hostParts = parse(host)
  if (!clientParts || !hostParts) return 'unknown'

  const length = Math.max(clientParts.length, hostParts.length)
  for (let i = 0; i < length; i++) {
    const c = clientParts[i] ?? 0
    const h = hostParts[i] ?? 0
    if (c < h) return 'client-older'
    if (c > h) return 'client-newer'
  }
  return 'same'
}
