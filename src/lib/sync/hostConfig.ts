// Which server this device syncs against — see src/lib/sync/engine.ts's
// switchHost() for how changing this actually re-points a device, and
// src/pages/Settings.tsx for the UI that calls it.
//
// Stored under its own key straight through storageAdapter, deliberately
// NOT a zustand `persist` store and NOT registered as shop data (see
// src/lib/storageKeys.ts's DEVICE_LOCAL_KEYS) — the same pattern as
// src/lib/deviceId.ts and src/lib/sync/outbox.ts, for a sharper reason
// here: if this synced, the main device would push "I am the main device"
// to every follower and point them all at themselves. If it were in
// backups, restoring the shop's backup onto a tablet would silently turn
// that tablet into a host too.
import { storageAdapter } from '../storageAdapter'
import { DEVICE_LOCAL_KEYS } from '../storageKeys'
import { useSecurityStore } from '../../store/securityStore'

const HOST_CONFIG_KEY = DEVICE_LOCAL_KEYS.syncHost
const LAN_PORT = 5174

export interface HostConfig {
  /** 'main': this device hosts its own embedded server (today's default —
   *  every device starts as its own host until pointed at another one).
   *  'follower': sync against `host` instead. */
  role: 'main' | 'follower'
  /** A bare LAN IP/hostname ('192.168.1.20'), a host:port, or a full URL —
   *  see resolveBaseUrl for how each is normalized. Only meaningful when
   *  role is 'follower'; null before any host has ever been set. */
  host: string | null
  /** The shop password to send with every request, if the host requires
   *  one (see server/syncServer.ts's SHOP_TOKEN). null when not needed. */
  token: string | null
}

const DEFAULT_CONFIG: HostConfig = { role: 'main', host: null, token: null }

export function readHostConfig(): HostConfig {
  const raw = storageAdapter.getItem(HOST_CONFIG_KEY)
  if (!raw) return DEFAULT_CONFIG
  try {
    const parsed = JSON.parse(raw)
    return {
      role: parsed.role === 'follower' ? 'follower' : 'main',
      host: typeof parsed.host === 'string' ? parsed.host : null,
      token: typeof parsed.token === 'string' ? parsed.token : null,
    }
  } catch {
    return DEFAULT_CONFIG
  }
}

export function writeHostConfig(config: HostConfig): void {
  storageAdapter.setItem(HOST_CONFIG_KEY, JSON.stringify(config))
}

/**
 * Normalizes whatever was typed into the host field to a base URL:
 * `192.168.1.20` -> `http://192.168.1.20:5174`, `192.168.1.20:8080` and
 * `http://192.168.1.20:8080` pass through their own port/scheme unchanged.
 * Exported so Settings.tsx can compare a typed address against this device's
 * own — see its "don't let a device follow itself" guard, which matters
 * because on the shop PC, local storage and the embedded LAN server's
 * database are the same file (see storageAdapter.ts / electron/main.ts);
 * pointing a follower at its own address would wipe that shared file with
 * nothing left to recover it from.
 */
export function normalizeHostUrl(host: string): string {
  const withScheme = /^https?:\/\//.test(host) ? host : `http://${host}`
  const hasExplicitPort = /:\d+(\/|$)/.test(withScheme.replace(/^https?:\/\//, ''))
  return hasExplicitPort ? withScheme.replace(/\/$/, '') : `${withScheme.replace(/\/$/, '')}:${LAN_PORT}`
}

/**
 * The server this device talks to. A configured follower host always wins.
 * Otherwise falls back to today's behaviour — infer from how this page
 * itself was loaded — which is what keeps every already-working setup
 * (a tablet on the shop PC's bookmarked address, the shop PC's own window)
 * working with nothing configured.
 */
export function resolveBaseUrl(config: HostConfig = readHostConfig()): string {
  if (config.role === 'follower' && config.host) {
    return normalizeHostUrl(config.host)
  }
  const hostname = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost'
  return `http://${hostname}:${LAN_PORT}`
}

/**
 * The token to send with every request. An explicit per-device override
 * (typed in when pairing this device from cold — this HostConfig's own
 * `token`) wins; otherwise falls back to the token this device already has
 * synced down as part of the shop's data (src/store/securityStore.ts).
 *
 * This is the whole reason turning on Settings > Security's "Require token
 * on LAN" switch doesn't 401 every already-paired tablet: each of them
 * received the real lanToken via the normal security-store sync, often
 * well before the switch was ever flipped, so the moment the server starts
 * demanding a token, they already have one to send — nothing to type on
 * any of them. Only a genuinely new device, one that has never synced,
 * needs the token typed into the "Shop password" field by hand.
 */
export function resolveAuthToken(config: HostConfig = readHostConfig()): string | null {
  return config.token ?? useSecurityStore.getState().security.lanToken
}

/**
 * True when `candidate` normalizes to the same address as any of
 * `knownSelfAddresses` — the guard sitting upstream of switchHost()'s
 * conditional wipe (see sync/engine.ts and this file's own header): a
 * follower pointed at its own address would wipe the very SQLite file it's
 * trying to read a snapshot from, since on a shop PC local storage and the
 * embedded LAN server share one file. Used to live as Settings.tsx's own
 * `isOwnAddress` closure, untestable inside a `.tsx`. `knownSelfAddresses`
 * is typically `[lanUrl, 'http://localhost:5174', 'http://127.0.0.1:5174']` —
 * this device's own displayed LAN URL plus the two loopback spellings.
 */
export function isSelfHost(candidate: string, knownSelfAddresses: (string | null)[]): boolean {
  if (!candidate.trim()) return false
  const normalized = normalizeHostUrl(candidate.trim())
  return knownSelfAddresses
    .filter((a): a is string => !!a)
    .some((a) => normalizeHostUrl(a) === normalized)
}
