// Orchestrates the whole sync loop: on start, join cold (snapshot) or catch
// up (pull since cursor), push whatever's queued locally, then listen for
// the server's "something changed" SSE ping so the next pull is near-instant
// instead of on a timer — with a slow poll as a fallback for whenever SSE
// itself is what's down.
//
// Every network call here is wrapped so a failure just means "we're
// offline" (see src/store/syncStatusStore.ts) — there is no failure mode in
// this file that should ever throw into the app or block a page from
// rendering. The shop must keep working with no WiFi; this is what makes
// that true for the parts of the app that talk to the network at all.
//
// createSyncEngine() takes every real dependency (storage, the network
// client, the status sink, which units sync, the clock, the timers) as a
// parameter instead of reaching for module-level singletons — the previous
// shape couldn't be tested at all: baseUrl/token/started/pushTimer/
// closeEventStream lived as module state, and startSync()'s setInterval was
// never cleared. A test now builds a fake client and an in-memory storage
// and asserts on real engine behavior (cold join, catch-up ordering, outbox
// retry, switchHost failure recovery) with no network and no browser — see
// src/lib/__tests__/syncEngine.test.ts.
//
// The bottom of this file wires one real instance to the real storageAdapter/
// client/status store and exports startSync/forceResync/switchHost exactly
// as before, so src/App.tsx and src/pages/Settings.tsx don't need to change
// their imports.
import { storageAdapter, type StorageAdapter } from '../storageAdapter'
import { startTracker, withTrackingSuppressed, onLocalChange } from './tracker'
import { readOutbox, removeFromOutbox, clearOutbox } from './outbox'
import { fetchSnapshot, fetchOpsSince, pushOps, openEventStream, UnauthorizedError } from './client'
import { applyOpsToBlob } from './merge'
import { SYNC_UNITS, type SyncUnit } from './storeRegistry'
import { planSnapshotApply } from './snapshotPlan'
import { useSyncStatusStore } from '../../store/syncStatusStore'
import type { SyncStatusState } from '../../store/syncStatusStore'
import { readHostConfig, writeHostConfig, resolveBaseUrl, type HostConfig } from './hostConfig'
import { PERSISTED_STORES, DEVICE_LOCAL_KEYS } from '../storageKeys'
import type { SyncOp, SyncOpWithSeq } from './types'

// A slow fallback in case SSE itself is what's unreachable (e.g. a proxy
// that buffers/drops long-lived connections) — not the primary trigger.
const POLL_INTERVAL_MS = 15_000
// After a local change, give the outbox a moment to collect any other
// changes made in the same beat (e.g. several fields saved together) instead
// of firing one push per keystroke-adjacent write.
const PUSH_DEBOUNCE_MS = 500

/**
 * 'auto' is the historical behavior — cold-join if this device has never
 * synced (cursor 0), catch up otherwise — used by the poll loop, the SSE
 * ping, and a local-change-triggered push, none of which know or care which
 * case they're in. 'cold' and 'catchup' are explicit requests from
 * forceResync/switchHost, which both reset the cursor to 0 for reasons that
 * have nothing to do with "never synced".
 */
export type SyncMode = 'auto' | 'cold' | 'catchup'

/** The network surface engine.ts needs — matches client.ts's exports
 *  exactly, so the production binding at the bottom of this file is a
 *  one-line passthrough. A test supplies a stub that never touches
 *  fetch/EventSource. */
export interface SyncClient {
  fetchSnapshot(baseUrl: string, token: string | null): Promise<{ data: Record<string, string>; seq: number }>
  fetchOpsSince(baseUrl: string, since: number, token: string | null): Promise<SyncOpWithSeq[]>
  pushOps(baseUrl: string, ops: SyncOp[], token: string | null): Promise<{ seqs: (number | null)[] }>
  openEventStream(baseUrl: string, onOps: () => void, token: string | null): () => void
  /** True for whatever this client's fetch* functions throw on a 401 — kept
   *  as a predicate rather than exposing the error class itself, so a test's
   *  stub client doesn't need to import client.ts's real UnauthorizedError. */
  isUnauthorizedError(e: unknown): boolean
}

export interface SyncEngineDeps {
  storage: StorageAdapter
  client: SyncClient
  /** Applies a partial status patch — production wires this to
   *  useSyncStatusStore.getState().setStatus. */
  status: (patch: Partial<SyncStatusState>) => void
  /** A getter, not a static array, so a test can supply a small fixed unit
   *  list without importing storeRegistry.ts's real store modules. */
  units: () => readonly SyncUnit[]
  now: () => Date
  setTimeout: typeof setTimeout
  setInterval: typeof setInterval
  clearInterval: typeof clearInterval
}

export interface SyncEngine {
  /** Wires everything up and does the first sync. Idempotent — safe to call
   *  once from App.tsx even across fast-refresh/remount in dev. */
  start(): void
  /** Clears the poll interval and closes the SSE connection. The running app
   *  never calls this (the engine lives for the process); it's what lets a
   *  test create a fresh engine per test case and tear it down cleanly. */
  stop(): void
  syncNow(mode?: SyncMode): Promise<void>
  forceResync(): void
  switchHost(config: HostConfig): void
}

export function createSyncEngine(deps: SyncEngineDeps): SyncEngine {
  const CURSOR_KEY = DEVICE_LOCAL_KEYS.syncCursor

  function readCursor(): number {
    const raw = deps.storage.getItem(CURSOR_KEY)
    return raw ? parseInt(raw, 10) || 0 : 0
  }

  function writeCursor(seq: number): void {
    if (seq > readCursor()) deps.storage.setItem(CURSOR_KEY, String(seq))
  }

  /** Apply a batch of incoming ops: group by sync unit, merge each unit's
   *  blob once, write it back (suppressed so the tracker doesn't re-queue
   *  it), then rehydrate the live stores that changed. */
  function applyRemoteOps(ops: SyncOpWithSeq[]): void {
    if (ops.length === 0) return

    const byStorageKey = new Map<string, SyncOpWithSeq[]>()
    for (const op of ops) {
      const list = byStorageKey.get(op.entity) ?? []
      list.push(op)
      byStorageKey.set(op.entity, list)
    }

    const units = deps.units()
    withTrackingSuppressed(() => {
      for (const [storageKey, keyOps] of byStorageKey) {
        const matching = units.filter((u) => u.storageKey === storageKey)
        if (matching.length === 0) continue

        let blob = deps.storage.getItem(storageKey)
        let changed = false
        for (const unit of matching) {
          // Multiple sync units can share one storageKey (e.g. expense-store's
          // `expenses` list and `categories` singleton) — `field` is what
          // keeps their ops from being applied to the wrong one.
          const unitOps = keyOps.filter((op) => op.field === unit.itemsField)
          if (unitOps.length === 0) continue
          blob = applyOpsToBlob(unit.kind, unit.itemsField, blob, unitOps)
          changed = true
        }
        if (changed && blob !== null) {
          deps.storage.setItem(storageKey, blob)
          for (const unit of matching) unit.rehydrate()
        }
      }
    })

    writeCursor(Math.max(...ops.map((op) => op.seq)))
  }

  /**
   * A device with nothing local yet (or one that's adopting a different
   * host, or resyncing from scratch): take the shop's current full state
   * directly rather than replaying its entire history op by op.
   *
   * The snapshot response is the *whole* keyspace, unfiltered — see
   * server/db.ts's snapshot(). planSnapshotApply() is what keeps this
   * device's own device-id/sync-host/sync-outbox/sync-cursor from being
   * overwritten by whatever the host's happen to be, and removes any
   * shop-data key this device has locally that the snapshot doesn't
   * contain — the snapshot is authoritative for every shop-data key, so its
   * absence means "the host never wrote this," not "leave whatever's here."
   *
   * Returns false (applying nothing, moving nothing) when the snapshot has
   * no shop data at all but the host's `seq` is already past 0 — see the
   * caller in syncNow() for why that specific combination has to fall
   * through to a full ops replay instead of being treated as "this device
   * now has zero shop data, cursor is `seq`."
   */
  async function joinCold(baseUrl: string, token: string | null): Promise<boolean> {
    const { data, seq } = await deps.client.fetchSnapshot(baseUrl, token)
    const localShopDataKeys = PERSISTED_STORES.map((s) => s.storageKey).filter(
      (key) => deps.storage.getItem(key) !== null
    )
    const plan = planSnapshotApply(data, localShopDataKeys)

    if (plan.writes.length === 0 && seq > 0) {
      return false
    }

    withTrackingSuppressed(() => {
      for (const [key, value] of plan.writes) deps.storage.setItem(key, value)
      for (const key of plan.removals) deps.storage.removeItem(key)
    })
    for (const unit of deps.units()) unit.rehydrate()
    writeCursor(seq)
    return true
  }

  async function pushOutbox(baseUrl: string, token: string | null): Promise<void> {
    const pending = readOutbox()
    if (pending.length === 0) return
    await deps.client.pushOps(baseUrl, pending, token)
    removeFromOutbox(new Set(pending.map((op) => op.id)))
  }

  // Re-derived from hostConfig whenever the engine (re)connects — see
  // connect() below, called once from start() and again from switchHost()
  // whenever the user points this device at a different server.
  let baseUrl = ''
  let token: string | null = null
  let closeEventStream: (() => void) | null = null
  let pollTimer: ReturnType<typeof setInterval> | null = null
  let pushTimer: ReturnType<typeof setTimeout> | null = null
  let started = false

  async function syncNow(mode: SyncMode = 'auto'): Promise<void> {
    deps.status({ phase: 'syncing' })
    try {
      const wantsCold = mode === 'cold' || (mode === 'auto' && readCursor() === 0)
      if (wantsCold) {
        const applied = await joinCold(baseUrl, token)
        // The snapshot had no shop data but the host is already past seq 0
        // — see joinCold's doc comment. Fall through to a full ops replay
        // from scratch instead of a snapshot that would have blanked this
        // device and skipped straight past history it never saw.
        if (!applied) applyRemoteOps(await deps.client.fetchOpsSince(baseUrl, 0, token))
      } else {
        applyRemoteOps(await deps.client.fetchOpsSince(baseUrl, readCursor(), token))
      }
      await pushOutbox(baseUrl, token)
      deps.status({
        phase: 'synced',
        lastSyncedAt: deps.now().toISOString(),
        pendingCount: readOutbox().length,
        lastError: null,
      })
    } catch (e) {
      if (deps.client.isUnauthorizedError(e)) {
        deps.status({ phase: 'unauthorized', lastError: 'Wrong or missing shop password', pendingCount: readOutbox().length })
        return
      }
      deps.status({ phase: 'offline', lastError: e instanceof Error ? e.message : String(e), pendingCount: readOutbox().length })
    }
  }

  function schedulePush(): void {
    deps.status({ pendingCount: readOutbox().length })
    if (pushTimer) return
    pushTimer = deps.setTimeout(() => {
      pushTimer = null
      void syncNow()
    }, PUSH_DEBOUNCE_MS)
  }

  /**
   * The "something looks wrong, start over" escape hatch (Settings page):
   * drop this device's cursor back to zero and re-pull the current host's
   * full state from scratch, same as a device joining cold for the first
   * time — including removing any local store the host no longer has
   * (joinCold's plan.removals), which this device joining cold for real
   * would also get. Never touches the outbox — any of this device's own
   * not-yet-pushed changes are still local edits waiting to go out, not
   * something a resync should discard. Passes mode: 'cold' explicitly
   * rather than relying on readCursor() === 0 — that reads as "never
   * synced," which isn't what's happening here.
   */
  function forceResync(): void {
    deps.storage.setItem(CURSOR_KEY, '0')
    void syncNow('cold')
  }

  /** (Re)point this device's SSE connection at the current baseUrl/token. */
  function reconnectEventStream(): void {
    closeEventStream?.()
    closeEventStream = null
    if (typeof EventSource !== 'undefined') {
      closeEventStream = deps.client.openEventStream(baseUrl, () => void syncNow(), token)
    }
  }

  function connect(): void {
    const config = readHostConfig()
    baseUrl = resolveBaseUrl(config)
    token = config.token
    reconnectEventStream()
  }

  /**
   * Point this device at a different server — a different main device, or a
   * standalone deployment like a Ubuntu server (see server/index.ts). Per
   * the multi-device plan's decision, adopting a *different remote* host
   * means this device's own local copy (and anything it hadn't pushed yet)
   * is replaced rather than merged — Settings.tsx warns about this before
   * calling switchHost.
   *
   * Fetch-then-apply, not wipe-then-fetch: the wipe used to happen here,
   * unconditionally, before contacting the new host at all — so a typo'd
   * IP, a host that's down, or a wrong password left the device with zero
   * local data, an empty outbox, and a host config pointing at nothing,
   * with no recovery path in the UI. Nothing here is destroyed until
   * joinCold has a snapshot in hand; on failure syncNow() catches the error
   * and reports 'offline'/'unauthorized' with every local store untouched,
   * and the pointed-at host can simply be retried or the device switched
   * back.
   *
   * This also makes the old adoptingRemote wipe-guard unnecessary.
   * Switching back to `role: 'main'` is self-referential on a shop PC
   * (storageAdapter and the embedded server share one SQLite file), so the
   * "snapshot" joinCold fetches is exactly this device's own current data —
   * planSnapshotApply's removals come out empty because every local key is
   * trivially present in its own snapshot. Switching to a genuinely
   * different remote host removes exactly the local shop-data keys that
   * host doesn't have. Same code path, correct outcome either way — no
   * special case needed.
   */
  function switchHost(config: HostConfig): void {
    writeHostConfig(config)

    // Pending ops belong to the state this device is leaving behind —
    // either the old host's history (misattributing them there would be
    // wrong) or, when going back to main, edits this device already has
    // locally anyway (the outbox is only ever "what to tell a followed
    // host", not the data itself). Unlike forceResync, which deliberately
    // keeps the outbox, a host switch always clears it.
    clearOutbox()

    deps.storage.setItem(CURSOR_KEY, '0')
    connect()
    void syncNow('cold')
  }

  function start(): void {
    if (started) return
    started = true

    connect()
    startTracker()
    onLocalChange(schedulePush)

    void syncNow()

    pollTimer = deps.setInterval(() => void syncNow(), POLL_INTERVAL_MS)
  }

  function stop(): void {
    if (pollTimer !== null) {
      deps.clearInterval(pollTimer)
      pollTimer = null
    }
    closeEventStream?.()
    closeEventStream = null
    started = false
  }

  return { start, stop, syncNow, forceResync, switchHost }
}

// The one real instance the running app uses — wired to the actual
// storageAdapter, the real network client, and the live status store.
// src/App.tsx calls startSync() once; src/pages/Settings.tsx calls
// forceResync()/switchHost() from the sync settings card. Neither import
// path changes: both still come from this file.
const defaultEngine = createSyncEngine({
  storage: storageAdapter,
  client: {
    fetchSnapshot,
    fetchOpsSince,
    pushOps,
    openEventStream,
    isUnauthorizedError: (e) => e instanceof UnauthorizedError,
  },
  status: (patch) => useSyncStatusStore.getState().setStatus(patch),
  units: () => SYNC_UNITS,
  now: () => new Date(),
  setTimeout,
  setInterval,
  clearInterval,
})

export function startSync(): void {
  defaultEngine.start()
}

export function forceResync(): void {
  defaultEngine.forceResync()
}

export function switchHost(config: HostConfig): void {
  defaultEngine.switchHost(config)
}
