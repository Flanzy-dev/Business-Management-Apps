// Server-side half of src/lib/auth/password.ts — verifies a plaintext
// password against the exact same stored format that file produces:
//
//   pbkdf2$sha256$<iterations>$<saltBase64>$<hashBase64>
//
// Deliberately a SEPARATE implementation rather than adding
// src/lib/auth/password.ts to tsconfig.server.json's include list. That
// file is written for the renderer: it derives with @noble/hashes (pure JS,
// chosen because `crypto.subtle` is unavailable on the plain-http:// pages
// this app serves to LAN tablets) and encodes base64 with `btoa`/`atob`,
// which are browser globals this build has no `lib: ["DOM"]` for. Node has
// PBKDF2-HMAC-SHA256 natively in C and `Buffer` for base64, so here that is
// simply the better tool — and it is the *same* standard primitive, so a
// hash produced by the renderer verifies here byte-for-byte.
//
// Verify-only on purpose. Nothing on the server ever creates or changes a
// password: accounts are made in the app and reach the host through normal
// security-store sync (see src/store/securityStore.ts). A server that could
// only ever check a credential, never mint one, is one less thing to get
// wrong.
import { pbkdf2Sync, timingSafeEqual } from 'crypto'

const SCHEME = 'pbkdf2'
const ALGORITHM = 'sha256'
const KEY_BYTES = 32

/**
 * True when `plain` is the password behind `stored`. Never throws — a
 * malformed, empty, or unrecognized-scheme stored string just fails to
 * verify, exactly as src/lib/auth/password.ts's verifyPassword does, so a
 * corrupt security-store row reads as "wrong password" rather than taking
 * the whole login route down with a 500.
 */
export function verifyPasswordHash(plain: string, stored: string): boolean {
  if (!stored) return false
  const parts = stored.split('$')
  if (parts.length !== 5) return false
  const [scheme, alg, iterationsRaw, saltB64, hashB64] = parts
  if (scheme !== SCHEME || alg !== ALGORITHM) return false

  const iterations = Number(iterationsRaw)
  if (!Number.isInteger(iterations) || iterations <= 0) return false
  // A hostile security-store row could name an absurd iteration count and
  // turn one login request into a multi-second CPU burn on the shop's own
  // PC. The renderer writes 210_000 (password.ts's PBKDF2_ITERATIONS); this
  // ceiling leaves generous room to raise that later without ever letting
  // the number become a denial-of-service knob.
  if (iterations > 5_000_000) return false

  let salt: Buffer
  let expected: Buffer
  try {
    salt = Buffer.from(saltB64, 'base64')
    expected = Buffer.from(hashB64, 'base64')
  } catch {
    return false
  }
  if (salt.length === 0 || expected.length !== KEY_BYTES) return false

  try {
    const actual = pbkdf2Sync(Buffer.from(plain, 'utf8'), salt, iterations, KEY_BYTES, ALGORITHM)
    return timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}
