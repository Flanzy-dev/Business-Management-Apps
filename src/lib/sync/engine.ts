// Orchestrates the whole sync loop: on start, join cold (snapshot) or catch
// up (pull since cursor), push whatever's queued locally, then listen for
// the server's "something changed" SSE ping so the next pull is near-instant
// instead of on a timer — with a slow poll as a fallback for whenever SSE
// itself is what's down. Call src/lib/sync/engine.ts's startSync() exactly
// once, from src/App.tsx.
//
// Every network call here is wrapped so a failure just means "we're
// offline" (see src/store/syncStatusStore.ts) — there is no failure mode in
// this file that should ever throw into the app or block a page from
// rendering. The shop must keep working with no WiFi; this is what makes
// that true for the parts of the app that talk to the network at all.
import { storageAdapter } from '../storageAdapter'
import { startTracker, withTrackingSuppressed, onLocalChange } from './tracker'
import { readOutbox, removeFromOutbox, clearOutbox } from './outbox'
import { fetchSnapshot, fetchOpsSince, pushOps, openEventStream, UnauthorizedError } from './client'
import { applyOpsToBlob } from './merge'
import { SYNC_UNITS } from './storeRegistry'
import { useSyncStatusStore } from '../../store/syncStatusStore'
import { readHostConfig, writeHostConfig, resolveBaseUrl, type HostConfig } from './hostConfig'
import { PERSISTED_STORES } from '../persistence'
import type { SyncOpWithSeq } from './types'

const CURSOR_KEY = 'sync-cursor'
// A slow fallback in case SSE itself is what's unreachable (e.g. a proxy
// that buffers/drops long-lived connections) — not the primary trigger.
const POLL_INTERVAL_MS = 15_000
// After a local change, give the outbox a moment to collect any other
// changes made in the same beat (e.g. several fields saved together) instead
// of firing one push per keystroke-adjacent write.
const PUSH_DEBOUNCE_MS = 500

function readCursor(): number {
  const raw = storageAdapter.getItem(CURSOR_KEY)
  return raw ? parseInt(raw, 10) || 0 : 0
}

function writeCursor(seq: number): void {
  if (seq > readCursor()) storageAdapter.setItem(CURSOR_KEY, String(seq))
}

/** Apply a batch of incoming ops: group by sync unit, merge each unit's blob
 *  once, write it back (suppressed so the tracker doesn't re-queue it), then
 *  rehydrate the live stores that changed. */
function applyRemoteOps(ops: SyncOpWithSeq[]): void {
  if (ops.length === 0) return

  const byStorageKey = new Map<string, SyncOpWithSeq[]>()
  for (const op of ops) {
    const list = byStorageKey.get(op.entity) ?? []
    list.push(op)
    byStorageKey.set(op.entity, list)
  }

  withTrackingSuppressed(() => {
    for (const [storageKey, keyOps] of byStorageKey) {
      const units = SYNC_UNITS.filter((u) => u.storageKey === storageKey)
      if (units.length === 0) continue

      let blob = storageAdapter.getItem(storageKey)
      let changed = false
      for (const unit of units) {
        // Multiple sync units can share one storageKey (e.g. expense-store's
        // `expenses` list and `categories` singleton) — `field` is what
        // keeps their ops from being applied to the wrong one.
        const unitOps = keyOps.filter((op) => op.field === unit.itemsField)
        if (unitOps.length === 0) continue
        blob = applyOpsToBlob(unit.kind, unit.itemsField, blob, unitOps)
        changed = true
      }
      if (changed && blob !== null) {
        storageAdapter.setItem(storageKey, blob)
        for (const unit of units) unit.rehydrate()
      }
    }
  })

  writeCursor(Math.max(...ops.map((op) => op.seq)))
}

/** A device with nothing local yet: take the shop's current full state
 *  directly rather than replaying its entire history op by op. */
async function joinCold(baseUrl: string, token: string | null): Promise<void> {
  const { data, seq } = await fetchSnapshot(baseUrl, token)
  withTrackingSuppressed(() => {
    for (const [key, value] of Object.entries(data)) {
      storageAdapter.setItem(key, value)
    }
  })
  for (const unit of SYNC_UNITS) unit.rehydrate()
  writeCursor(seq)
}

async function pushOutbox(baseUrl: string, token: string | null): Promise<void> {
  const pending = readOutbox()
  if (pending.length === 0) return
  await pushOps(baseUrl, pending, token)
  removeFromOutbox(new Set(pending.map((op) => op.id)))
}

// Re-derived from hostConfig whenever the engine (re)connects — see
// connect() below, called once from startSync() and again from
// switchHost() whenever the user points this device at a different server.
let baseUrl = ''
let token: string | null = null
let closeEventStream: (() => void) | null = null

async function syncNow(): Promise<void> {
  const { setStatus } = useSyncStatusStore.getState()
  setStatus({ phase: 'syncing' })
  try {
    if (readCursor() === 0) {
      await joinCold(baseUrl, token)
    } else {
      applyRemoteOps(await fetchOpsSince(baseUrl, readCursor(), token))
    }
    await pushOutbox(baseUrl, token)
    setStatus({
      phase: 'synced',
      lastSyncedAt: new Date().toISOString(),
      pendingCount: readOutbox().length,
      lastError: null,
    })
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      setStatus({ phase: 'unauthorized', lastError: 'Wrong or missing shop password', pendingCount: readOutbox().length })
      return
    }
    setStatus({ phase: 'offline', lastError: e instanceof Error ? e.message : String(e), pendingCount: readOutbox().length })
  }
}

let pushTimer: ReturnType<typeof setTimeout> | null = null
function schedulePush(): void {
  useSyncStatusStore.getState().setStatus({ pendingCount: readOutbox().length })
  if (pushTimer) return
  pushTimer = setTimeout(() => {
    pushTimer = null
    void syncNow()
  }, PUSH_DEBOUNCE_MS)
}

/**
 * The "something looks wrong, start over" escape hatch (Settings page):
 * drop this device's cursor back to zero and re-pull the current host's full
 * state from scratch, same as a device joining cold for the first time.
 * Never touches the outbox — any of this device's own not-yet-pushed changes
 * are still local edits waiting to go out, not something a resync should
 * discard.
 */
export function forceResync(): void {
  storageAdapter.setItem(CURSOR_KEY, '0')
  void syncNow()
}

/** (Re)point this device's SSE connection at the current baseUrl/token. */
function reconnectEventStream(): void {
  closeEventStream?.()
  closeEventStream = null
  if (typeof EventSource !== 'undefined') {
    closeEventStream = openEventStream(baseUrl, () => void syncNow(), token)
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
 * standalone deployment like a Ubuntu server (see server/index.ts). Per the
 * multi-device plan's decision, adopting a *different remote* host means
 * this device's own local copy (and anything it hadn't pushed yet) is
 * replaced rather than merged — Settings.tsx warns about this before
 * calling switchHost. Switching back to `role: 'main'` is not that: this
 * device already *is* the data (there is nothing remote to adopt), so its
 * local copy is left untouched — see the wipe guard below.
 */
export function switchHost(config: HostConfig): void {
  const adoptingRemote = config.role === 'follower' && !!config.host

  writeHostConfig(config)

  // Pending ops belong to the state this device is leaving behind — either
  // the old host's history (misattributing them there would be wrong) or,
  // when going back to main, edits this device already has locally anyway
  // (the outbox is only ever "what to tell a followed host", not the data
  // itself). Unlike forceResync, which deliberately keeps the outbox, a host
  // switch always clears it.
  clearOutbox()

  if (adoptingRemote) {
    // joinCold only overwrites keys present in the snapshot; a store the new
    // host has never written would otherwise keep this device's stale blob,
    // making "adopt the new host's data" only half true. Only done when
    // genuinely switching to a different remote — never for a return to
    // 'main', where wiping first would destroy the very data the (self-
    // hosted, self-referential) rejoin below is supposed to read back.
    withTrackingSuppressed(() => {
      for (const { storageKey } of PERSISTED_STORES) storageAdapter.removeItem(storageKey)
    })
    for (const unit of SYNC_UNITS) unit.rehydrate()
  }

  storageAdapter.setItem(CURSOR_KEY, '0')
  connect()
  void syncNow()
}

let started = false

/** Start the sync engine. Idempotent — safe to call once from App.tsx even
 *  across fast-refresh/remount in dev. */
export function startSync(): void {
  if (started) return
  started = true

  connect()
  startTracker()
  onLocalChange(schedulePush)

  void syncNow()

  setInterval(() => void syncNow(), POLL_INTERVAL_MS)
}
