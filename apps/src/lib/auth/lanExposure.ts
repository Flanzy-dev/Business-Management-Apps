// Whether the shop's data is currently readable by anyone on its WiFi.
//
// The sync server on the shop PC only demands a token once the shop has an admin
// account (server/shopToken.ts) — and a tablet gets that token by signing in
// with the account, so a shop with no account has no way to hand one out. The
// server therefore cannot simply be locked from the first launch without
// stranding every paired tablet. What can be done is to say so, loudly, for as
// long as it is true.
//
// Pure: the banner (components/layout/LanOpenBanner.tsx) supplies the inputs.

export interface LanExposureInput {
  /** True on the desktop app, the only build that runs a LAN server at all. */
  hostsLanServer: boolean
  /** 'follower' devices bind to localhost only (electron/main.ts). */
  syncRole: 'main' | 'follower'
  adminPasswordHash: string | null
  /** The "Require token on LAN" switch: an explicit way to close the window. */
  lanTokenRequired: boolean
}

/** True while this device serves the shop's data to the WiFi with no password gate. */
export function isLanOpen(input: LanExposureInput): boolean {
  if (!input.hostsLanServer || input.syncRole !== 'main') return false
  return !input.adminPasswordHash && !input.lanTokenRequired
}
