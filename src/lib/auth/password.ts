// PBKDF2-SHA256 password hashing via @noble/hashes (pure TypeScript, zero
// runtime dependencies, no native module — same reason sql.js was picked
// over a native SQLite driver, see CLAUDE.md's "Database" section).
//
// NOT Web Crypto's `crypto.subtle`, despite that needing no dependency at
// all: SubtleCrypto is only available in a "secure context" (https:// or
// file://), and this app is deliberately also reachable as a plain
// `http://192.168.x.x:5174` page in a browser tab on another device — see
// server/syncServer.ts's static file serving and sync.settingsDescription
// in src/lib/i18n/en.ts ("open this device's address in a browser"). Admin
// sign-in has to work from that tablet's browser too, where
// `crypto.subtle` is `undefined`. `crypto.getRandomValues` has no such
// restriction and is still used below for the salt.
//
// Threat model, stated plainly: this is a local, offline desktop app. The
// renderer can already read the raw key/value store through the
// unrestricted `db:getItem` IPC channel (see electron/main.ts), and anyone
// with devtools open can inspect zustand store state directly. Hashing the
// admin password stops it from sitting in plain text in an exported backup
// file or the database, and stops casual shoulder-surfing — it is NOT a
// defense against someone with the physical device and the intent to dig
// for it. Say this in the Settings UI, not just here.
import { pbkdf2Async } from '@noble/hashes/pbkdf2.js'
import { sha256 } from '@noble/hashes/sha2.js'

const SCHEME = 'pbkdf2'
const ALGORITHM = 'sha256'
/** Encoded into every stored hash, so raising this later doesn't invalidate
 *  passwords hashed under a lower count — verifyPassword always re-derives
 *  using whatever count the stored string says. */
export const PBKDF2_ITERATIONS = 210_000
const SALT_BYTES = 16
const KEY_BYTES = 32

/** Shared by the lock screen's create-password form and Settings' change-
 *  password form, so the two can't drift to different minimums. */
export const MIN_PASSWORD_LENGTH = 6

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function deriveBits(plain: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  return pbkdf2Async(sha256, plain, salt, { c: iterations, dkLen: KEY_BYTES })
}

export type PasswordValidationError = 'usernameRequired' | 'tooShort' | 'mismatch'

/**
 * The three rules a new/changed admin password must pass — shared by
 * LockScreen.tsx's create-password form and Settings.tsx's change-password
 * form, which used to hand-write the same three `if` branches in the same
 * order and could drift (a rule fixed in one form, missed in the other).
 * Returns an error *code* rather than a translated message — both call
 * sites already map all three onto the same `auth.lockScreen.*` keys, so the
 * translation stays in the component, not in this store-free lib module.
 */
export function validateNewPassword(input: {
  username: string
  password: string
  confirmPassword: string
}): PasswordValidationError | null {
  if (!input.username.trim()) return 'usernameRequired'
  if (input.password.length < MIN_PASSWORD_LENGTH) return 'tooShort'
  if (input.password !== input.confirmPassword) return 'mismatch'
  return null
}

/** Constant-time-ish comparison — a fixed-length XOR accumulation instead of
 *  `===`, so a wrong guess can't be distinguished by how early it fails.
 *  Only meaningful once both arrays are already the same length; a length
 *  mismatch itself is a normal early return, not a timing-sensitive branch,
 *  since it corresponds to a stored hash the code produced itself, not to
 *  attacker-controlled input length. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

/** Versioned, self-describing stored format: pbkdf2$sha256$<iters>$<saltB64>$<hashB64> */
export async function hashPassword(plain: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const hash = await deriveBits(plain, salt, PBKDF2_ITERATIONS)
  return `${SCHEME}$${ALGORITHM}$${PBKDF2_ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`
}

/** Never throws — a malformed, empty, or unrecognized-version stored string
 *  just fails to verify, the same as a wrong password. */
export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  if (!stored) return false
  const parts = stored.split('$')
  if (parts.length !== 5) return false
  const [scheme, alg, iterationsRaw, saltB64, hashB64] = parts
  if (scheme !== SCHEME || alg !== ALGORITHM) return false
  const iterations = Number(iterationsRaw)
  if (!Number.isInteger(iterations) || iterations <= 0) return false

  let salt: Uint8Array
  let expected: Uint8Array
  try {
    salt = fromBase64(saltB64)
    expected = fromBase64(hashB64)
  } catch {
    return false
  }

  try {
    const actual = await deriveBits(plain, salt, iterations)
    return timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}
