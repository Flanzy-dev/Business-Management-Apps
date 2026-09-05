// Backfill: guarantees a shop with an admin account always has a LAN token.
//
// src/store/authStore.ts's createAdminPassword already mints one for a
// brand-new account (see its own comment on why: so a device that pairs
// later is never missing the very thing server/shopToken.ts now demands the
// moment an account exists). This file exists for shops that already had an
// admin password before that minting existed — an upgrade, or a security-store
// row seeded some other way — and would otherwise sit with an account and no
// token, which server/shopToken.ts's readShopToken treats as "nothing to
// demand" and leaves the LAN server wide open despite having credentials to
// protect.
//
// Idempotent and safe to call on every launch: it's a no-op the moment a
// token exists, same shape as the other one-time backfills App.tsx already
// runs (runCostingBackfill, runStockLedgerBackfill,
// repairOrphanedScheduleRules) — call it from that same mount effect.
import { useSecurityStore } from '../../store/securityStore'
import { generateShopToken } from './shopToken'

export function ensureLanToken(): void {
  const { adminPasswordHash, lanToken } = useSecurityStore.getState().security
  if (adminPasswordHash && !lanToken) {
    useSecurityStore.getState().setLanToken(generateShopToken())
  }
}
