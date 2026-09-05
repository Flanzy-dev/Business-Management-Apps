// Renderer-side wrapper around the UDP host discovery that actually runs in
// the Electron main process (server/discovery.ts, bridged through
// electron/preload.ts's discoverHosts).
//
// Split out of the settings UI so the "can this device even discover?"
// question has one answer instead of one per component, and so the
// electronAPI shape is asserted in exactly one place — this project declares
// that global inline at each use site (see src/lib/storageAdapter.ts and
// src/components/settings/SyncCard.tsx) rather than in a shared .d.ts.
//
// A browser tab always reports "unavailable", and correctly so: a page has
// no UDP socket, and it does not need one — it loaded the app FROM the host
// it would be looking for, so src/lib/sync/hostConfig.ts's resolveBaseUrl()
// already infers the right address from window.location.

/** One host that answered a discovery probe. Mirrors server/discovery.ts's
 *  DiscoveredHost — redeclared rather than imported because that module is
 *  Node-only (it opens a UDP socket at import time in main), and pulling it
 *  into the renderer bundle would drag `dgram` in with it. */
export interface DiscoveredHost {
  address: string
  shopName: string | null
  port: number
}

interface DiscoveryBridge {
  discoverHosts?: () => Promise<DiscoveredHost[]>
}

function bridge(): DiscoveryBridge | null {
  if (typeof window === 'undefined') return null
  return (window as unknown as { electronAPI?: DiscoveryBridge }).electronAPI ?? null
}

/**
 * Whether this device can search the network at all. False in a browser tab,
 * and false in an Electron build older than the discovery bridge — the
 * optional-call guard matters because the renderer and the preload script
 * are separately built artifacts that can be mismatched in development.
 */
export function canDiscoverHosts(): boolean {
  return typeof bridge()?.discoverHosts === 'function'
}

/**
 * Search the network for shops. Always resolves — "found nothing" is an
 * ordinary answer (no host running, broadcasts dropped by the router, a
 * firewall in the way), and every one of those cases should leave the user
 * looking at the manual address field rather than at an error.
 *
 * `port` is folded into the returned address only when it isn't the default,
 * so the common case yields a bare IP that matches what someone would have
 * typed by hand — and so it round-trips cleanly through
 * src/lib/sync/hostConfig.ts's normalizeHostUrl().
 */
export async function findHosts(): Promise<DiscoveredHost[]> {
  const api = bridge()
  if (typeof api?.discoverHosts !== 'function') return []
  try {
    const hosts = await api.discoverHosts()
    return Array.isArray(hosts) ? hosts : []
  } catch {
    return []
  }
}

/** The string to put in the host field for a discovered host — a bare IP for
 *  the default port, `ip:port` otherwise. */
export function hostAddressFor(host: DiscoveredHost): string {
  return host.port === 5174 ? host.address : `${host.address}:${host.port}`
}
