// The decision inside src/lib/sync/engine.ts's joinCold(): given a
// /api/snapshot response, what should actually get written to (or removed
// from) this device's storage? Pulled out as a pure function — no
// storageAdapter, no network — so it's testable without mocking the whole
// engine, and so the device-local-key leak it fixes has a regression test
// that doesn't need a fake server.
//
// The bug this closes: server/db.ts's snapshot() and the old joinCold() both
// read/wrote the *whole* keyspace with no registry in sight. On an Electron
// host the IPC storage and the embedded server share one in-memory db
// object, so /api/snapshot served this device's own device-id, sync-host,
// sync-outbox, and sync-cursor right alongside shop data — and a cold-joining
// device adopted all four, silently corrupting its own identity and host
// config. See src/lib/storageKeys.ts's DEVICE_LOCAL_KEYS and
// docs/DATA_MODEL.md's "Sync-internal keys" section.
import { isShopDataKey } from '../storageKeys'

export interface SnapshotPlan {
  /** [key, value] pairs to write — shop-data keys present in the snapshot. */
  writes: [string, string][]
  /** Shop-data keys this device has locally that the snapshot does NOT
   *  contain — the host never wrote them, so "the snapshot is authoritative"
   *  means removing them, not leaving a stale local blob behind. */
  removals: string[]
}

/**
 * Plans how to apply a snapshot to local storage. `data` is the snapshot's
 * raw key→value payload (the whole keyspace, as the server sends it —
 * unfiltered on purpose, see server/db.ts's header). `localShopDataKeys` is
 * every shop-data key this device currently has something stored under.
 *
 * A key is written ONLY if it's a registered shop-data key — a positive
 * allowlist, not "anything that isn't one of the four known device-local
 * keys". That's the point: a future device-local key whose author forgets to
 * register it in DEVICE_LOCAL_KEYS is still safe by default, because it was
 * never going to pass isShopDataKey() either way. Unknown keys (in neither
 * list) are dropped for the same reason.
 */
export function planSnapshotApply(
  data: Record<string, string>,
  localShopDataKeys: readonly string[],
): SnapshotPlan {
  const writes: [string, string][] = []
  const presentShopKeys = new Set<string>()

  for (const [key, value] of Object.entries(data)) {
    if (!isShopDataKey(key)) continue
    writes.push([key, value])
    presentShopKeys.add(key)
  }

  const removals = localShopDataKeys.filter((key) => !presentShopKeys.has(key))

  return { writes, removals }
}
