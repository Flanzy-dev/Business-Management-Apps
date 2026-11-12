// Polls the shop's host for its app version, purely to learn whether THIS
// device is running older or newer code than the shop's host — see
// src/lib/update/versionCompare.ts and the warning line in
// src/components/settings/SyncRoleSection.tsx.
//
// Deliberately separate from src/lib/sync/engine.ts: that file's SyncClient
// interface is narrow and unit-tested (src/lib/__tests__/syncEngine.test.ts)
// on purpose, and this is purely cosmetic — adding a route the engine
// doesn't actually need to its tested surface, and giving it a new
// offline-failure path to handle, would cost more than it's worth for a
// warning label. Always silent on failure: an unreachable host is already
// represented by the sync status indicator (src/store/syncStatusStore.ts);
// this module has nothing useful to add on top of that.
//
// No-ops entirely unless this device is a configured FOLLOWER (hostConfig's
// role === 'follower', which is only ever true for a real paired Electron
// install — see hostConfig.ts's header). A 'main' device IS the host, so it
// can't be behind or ahead of itself; a browser tab always runs whatever
// bundle its host just served it (src/lib/update/updateBridge.ts's
// canAutoUpdate doc), so it can never differ from that host either. Neither
// case has anything for this to usefully report.
import { readHostConfig, resolveBaseUrl, resolveAuthToken } from '../sync/hostConfig'
import { fetchInfo } from '../sync/client'
import { useUpdateStore } from '../../store/updateStore'

const INITIAL_DELAY_MS = 10_000
const POLL_INTERVAL_MS = 30 * 60 * 1000

/** Starts the watch; returns a stop function. Safe to call unconditionally
 *  (e.g. from src/App.tsx) — see the no-op condition in the file header. */
export function startHostVersionWatch(): () => void {
  if (readHostConfig().role !== 'follower') return () => {}

  let stopped = false

  async function poll(): Promise<void> {
    try {
      const info = await fetchInfo(resolveBaseUrl(), resolveAuthToken())
      if (!stopped) useUpdateStore.getState().setHostVersion(info.version ?? null)
    } catch {
      // Silent on purpose — see file header.
    }
  }

  const timeout = setTimeout(() => void poll(), INITIAL_DELAY_MS)
  const interval = setInterval(() => void poll(), POLL_INTERVAL_MS)

  return () => {
    stopped = true
    clearTimeout(timeout)
    clearInterval(interval)
  }
}
