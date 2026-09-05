// Reading and rewriting security-store's admin-device binding inside a
// BACKUP FILE — used by src/pages/Settings.tsx's existing restore and by
// src/components/auth/LoginScreen.tsx's new recovery flow (a device locked
// out of Admin, per src/store/securityStore.ts's adminDeviceId, recovers by
// restoring a backup — see that field's doc comment).
//
// Deliberately NOT folded into src/lib/persistence.ts's applyBackup: that
// module is store-agnostic on purpose (its own test file's header argues
// against store-by-store special-casing), and threading a deviceId
// parameter through its generic signature would break every existing
// one-argument call site in persistence.test.ts for no benefit — nothing
// else needs to know a device id to restore a backup. Instead this is a
// pure pre-transform: rebindAdminDevice(data, deviceId) returns a patched
// copy of the backup object, which the caller then hands to the unmodified
// applyBackup(). No storageAdapter, no zustand, no src/lib/deviceId.ts
// import — deviceId is always passed in, so this stays trivially testable
// on plain objects.
//
// The backup shape being navigated: collectBackup() (persistence.ts) writes
// `backup[backupField] = storage.getItem(storageKey)` — i.e. `data.security`
// (PERSISTED_STORES's backupField for 'security-store') is a STRING, the raw
// zustand-persist envelope `{"state":{"security":{...}},"version":0}`, not
// the security object itself. Getting this one level wrong fails silently:
// the guard never matches, nothing gets patched, recovery does nothing.

interface SecurityEnvelope {
  state?: {
    security?: {
      adminPasswordHash?: unknown
      [key: string]: unknown
    }
    [key: string]: unknown
  }
  [key: string]: unknown
}

function parseSecurityEnvelope(data: Record<string, unknown>): SecurityEnvelope | null {
  const raw = data.security
  if (typeof raw !== 'string') return null
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as SecurityEnvelope) : null
  } catch {
    return null
  }
}

/**
 * The admin password hash embedded in a backup file, or null if this file
 * has no security-store row, isn't parsable, or never had a password set.
 * Used by LoginScreen's recovery flow to (a) refuse a file that isn't a real
 * shop backup before ever prompting for a password, and (b) verify the
 * entered password against THIS hash — the backup's own — not whatever
 * happens to be live-synced on this device, which is exactly what a
 * recovering device can't trust yet.
 */
export function readAdminPasswordHashFromBackup(data: Record<string, unknown>): string | null {
  const envelope = parseSecurityEnvelope(data)
  const hash = envelope?.state?.security?.adminPasswordHash
  return typeof hash === 'string' && hash ? hash : null
}

/**
 * Returns a NEW backup object (never mutates `data`) with security-store's
 * adminDeviceId patched to `deviceId` — i.e. "whoever restores this backup
 * becomes the shop's admin device from now on." adminUsername is left
 * exactly as restored: the username is the account's identity, the device
 * binding is a separate, device-specific fact, and only the latter changes
 * on recovery.
 *
 * A no-op (returns `data` itself) whenever there's nothing meaningful to
 * patch: no security-store row, unparsable, no `.state.security`, or no
 * adminPasswordHash on it (a backup taken before any admin password
 * existed) — there is no admin account in that case for this device to
 * become the owner of.
 */
export function rebindAdminDevice(data: Record<string, unknown>, deviceId: string): Record<string, unknown> {
  const envelope = parseSecurityEnvelope(data)
  const security = envelope?.state?.security
  if (!envelope || !security || !security.adminPasswordHash) return data

  const nextEnvelope: SecurityEnvelope = {
    ...envelope,
    state: {
      ...envelope.state,
      security: { ...security, adminDeviceId: deviceId },
    },
  }
  return { ...data, security: JSON.stringify(nextEnvelope) }
}
