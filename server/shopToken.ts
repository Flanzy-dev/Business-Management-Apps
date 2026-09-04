// Shared by both deployments — the Electron shop-PC host (electron/main.ts)
// and the standalone Ubuntu host (server/index.ts) — exactly like
// server/shopName.ts, and for the same reason: this file deliberately knows
// nothing about what a "security-store" is beyond how to read one row out
// of key_value_store, so it can run standalone or embedded with zero drift.
import type { SyncDatabase } from './db'

/**
 * Reads the LAN sync token out of the key_value_store row for
 * security-store, for syncServer.ts's isAuthorized to require on every
 * /api/* request. Returns undefined (not null — matches SyncServerOptions.
 * token's shape) whenever there's no token to require: no row yet, an
 * unparsable row, or the shop's "Require token on LAN" switch
 * (security.lanTokenRequired) is off. That last check is what keeps
 * updating the app from silently starting to demand a token nobody has
 * been shown yet — see src/store/securityStore.ts's lanTokenRequired,
 * which defaults to false for exactly this reason.
 *
 * The row holds a zustand-persist envelope whose state nests the security
 * object one level down — {"state":{"security":{…}},"version":0}, same
 * shape as shopName.ts reads for settings-store.
 */
export function readShopToken(db: SyncDatabase): string | undefined {
  try {
    const raw = db.getItem('security-store')
    if (!raw) return undefined
    const parsed = JSON.parse(raw)
    const security = parsed?.state?.security
    if (!security?.lanTokenRequired) return undefined
    const token = security.lanToken
    return typeof token === 'string' && token.trim() ? token : undefined
  } catch {
    return undefined
  }
}
