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
import { storageAdapter, type StorageAdapter } from '../storage/storageAdapter'
import { startTracker, withTrackingSuppressed, onLocalChange } from './tracker'
import { readOutbox, removeFromOutbox, clearOutbox } from './outbox'
import { fetchSnapshot, fetchOpsSince, pushOps, openEventStream, UnauthorizedError, RejectedOpsError, OPS_PAGE_SIZE } from './client'
import { applyOpsToBlob } from './merge'
import { quarantineOp } from './quarantine'
import { SYNC_UNITS, type SyncUnit } from './storeRegistry'
import { planSnapshotApply } from './snapshotPlan'
import { useSyncStatusStore } from '../../store/syncStatusStore'
import type { SyncStatusState } from '../../store/syncStatusStore'
import { readHostConfig, writeHostConfig, resolveBaseUrl, resolveAuthToken, type HostConfig } from './hostConfig'
import { PERSISTED_STORES, DEVICE_LOCAL_KEYS } from '../storage/storageKeys'
import type { SyncOp, SyncOpWithSeq } from './types'

// A slow fallback in case SSE itself is what's unreachable (e.g. a proxy
// that buffers/drops long-lived connections) — not the primary trigger.
const POLL_INTERVAL_MS = 15_000
// After a local change, give the outbox a moment to collect any other
// changes made in the same beat (e.g. several fields saved together) instead
// of firing one push per keystroke-adjacent write.
const PUSH_DEBOUNCE_MS = 500
// The server caps a push body (server/syncServer.ts). A device offline long
// enough builds an outbox bigger than that cap, and one giant push would 413
// forever — the outbox could never drain. Push in bounded chunks, dropping
// each accepted chunk as it lands so a mid-drain failure still makes progress.
const MAX_OPS_PER_PUSH = 250

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
  /** The batch indexes the host refused, when `e` is its "rejected ops" answer;
   *  null for any other failure. Optional so a stub client that never rejects
   *  needn't implement it. */
  rejectedOpIndexes?(e: unknown): number[] | null
  /** The subset of rejectedOpIndexes the host refused only because it doesn't
   *  know that store yet — an older host build than this device. Those ops are
   *  valid and must not be dropped; a host update will accept them. Optional
   *  like rejectedOpIndexes. */
  unknownEntityIndexes?(e: unknown): number[] | null
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
  // Narrowed to how this file actually calls them (a zero-arg handler plus a
  // delay), rather than `typeof setTimeout`/`typeof setInterval` — the engine
  // only ever needs these two shapes, and matching the real overloaded global
  // signature forces production's wiring below into arrow-function wrappers
  // whose call site keeps `this` off the timer functions entirely (see the
  // comment there for why a bare reference breaks in a browser/Electron).
  setTimeout: (handler: () => void, timeout: number) => ReturnType<typeof setTimeout>
  setInterval: (handler: () => void, timeout: number) => ReturnType<typeof setInterval>
  clearInterval: (handle: ReturnType<typeof setInterval>) => void
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

/** Which store fields this build syncs, as one comparable string. */
function syncSchemaFingerprint(units: readonly SyncUnit[]): string {
  return units
    .map((u) => `${u.storageKey}:${u.itemsField}`)
    .sort()
    .join(',')
}

function rowKey(op: Pick<SyncOp, 'entity' | 'field' | 'entityId'>): string {
  return JSON.stringify([op.entity, op.field, op.entityId])
}

/**
 * Incoming ops minus any for a row this device still has a pending op for.
 *
 * A pull runs before the push, and the host echoes this device's own ops back.
 * Without this, an older version of a row this device already pushed would be
 * applied over a newer edit still waiting in the outbox, and the field would
 * visibly snap back until the next round trip. Skipping is also what the host
 * itself will end up with: the pending op is pushed after, gets a higher seq,
 * and wins that row on every device anyway. If the host later refuses the
 * pending op instead, pushOutbox drops it and the engine runs a cold resync,
 * so a skipped op is never lost for good.
 */
function withoutRowsPendingLocally(ops: SyncOpWithSeq[], pending: readonly SyncOp[]): SyncOpWithSeq[] {
  if (pending.length === 0) return ops
  const pendingRows = new Set(pending.map(rowKey))
  return ops.filter((op) => !pendingRows.has(rowKey(op)))
}

/** Bucket a batch of incoming ops by which storage key they belong to — pure,
 *  no deps, the first step of applyRemoteOps. */
function groupOpsByStorageKey(ops: SyncOpWithSeq[]): Map<string, SyncOpWithSeq[]> {
  const byStorageKey = new Map<string, SyncOpWithSeq[]>()
  for (const op of ops) {
    const list = byStorageKey.get(op.entity) ?? []
    list.push(op)
    byStorageKey.set(op.entity, list)
  }
  return byStorageKey
}

/**
 * Fold one sync unit's own ops into a blob, one op at a time so a single
 * malformed payload can't take the rest of the batch down with it (see the
 * quarantine comment this used to carry inline) — quarantining just that op
 * lets every other op in the batch still apply, and lets the cursor keep
 * moving. Pure: takes the current blob, returns the next one.
 */
function mergeUnitOps(
  blob: string | null,
  unit: SyncUnit,
  unitOps: SyncOpWithSeq[]
): { blob: string | null; changed: boolean } {
  let changed = false
  for (const op of unitOps) {
    try {
      blob = applyOpsToBlob(unit.kind, unit.itemsField, blob, [op], unit.version)
      changed = true
    } catch (err) {
      quarantineOp(op, err instanceof Error ? err.message : String(err))
    }
  }
  return { blob, changed }
}

export function createSyncEngine(deps: SyncEngineDeps): SyncEngine {
  const CURSOR_KEY = DEVICE_LOCAL_KEYS.syncCursor
  const SCHEMA_KEY = DEVICE_LOCAL_KEYS.syncSchema

  function readCursor(): number {
    const raw = deps.storage.getItem(CURSOR_KEY)
    return raw ? parseInt(raw, 10) || 0 : 0
  }

  function writeCursor(seq: number): void {
    if (seq > readCursor()) deps.storage.setItem(CURSOR_KEY, String(seq))
  }

  /** One storage key's worth of incoming ops: merge every matching unit's
   *  blob, write it back, then rehydrate the live stores that changed.
   *  Multiple sync units can share one storageKey (e.g. expense-store's
   *  `expenses` list and `categories` singleton) — `field` is what keeps
   *  their ops from being applied to the wrong one. Must only ever be called
   *  from inside withTrackingSuppressed (see applyRemoteOps) — the setItem
   *  and rehydrate() calls here are exactly what must not re-queue into this
   *  device's own outbox. */
  function applyOpsForStorageKey(storageKey: string, keyOps: SyncOpWithSeq[], units: readonly SyncUnit[]): void {
    const matching = units.filter((u) => u.storageKey === storageKey)
    if (matching.length === 0) return

    let blob = deps.storage.getItem(storageKey)
    let anyChanged = false
    for (const unit of matching) {
      const unitOps = keyOps.filter((op) => op.field === unit.itemsField)
      if (unitOps.length === 0) continue
      const result = mergeUnitOps(blob, unit, unitOps)
      blob = result.blob
      if (result.changed) anyChanged = true
    }
    if (anyChanged && blob !== null) {
      deps.storage.setItem(storageKey, blob)
      for (const unit of matching) unit.rehydrate()
    }
  }

  /** Apply a batch of incoming ops: group by sync unit, merge each unit's
   *  blob once, write it back (suppressed so the tracker doesn't re-queue
   *  it), then rehydrate the live stores that changed. writeCursor runs
   *  after the suppressed block regardless of what happened inside it —
   *  even a fully-quarantined batch must still advance the cursor, or the
   *  same poison op gets refetched and re-thrown forever. */
  function applyRemoteOps(ops: SyncOpWithSeq[]): void {
    if (ops.length === 0) return

    const byStorageKey = groupOpsByStorageKey(withoutRowsPendingLocally(ops, readOutbox()))
    const units = deps.units()
    withTrackingSuppressed(() => {
      for (const [storageKey, keyOps] of byStorageKey) {
        applyOpsForStorageKey(storageKey, keyOps, units)
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
      // Rehydrate has to happen inside the same suppressed block as the
      // writes above, not after it: zustand's persist.rehydrate() ends in
      // its own storage.setItem (re-persisting whatever it just read back
      // into live state), and outside withTrackingSuppressed the tracker
      // would see that as a genuine local change and queue it to push right
      // back out — for a store the snapshot never actually touched (nothing
      // in plan.writes/plan.removals for it), that's this device's own
      // already-current state getting re-upserted for no reason, on every
      // cold join. Matches applyOpsForStorageKey's ordering below, which
      // already keeps its own rehydrate() calls inside the suppressed block.
      for (const unit of deps.units()) unit.rehydrate()
    })
    writeCursor(seq)
    return true
  }

  /** Stores the connected host refused as unknown — it runs an older build
   *  than this device. Their ops stay in the outbox but are held back from
   *  pushes until connect() runs again (a reconnect or the next app start),
   *  so they can't block everything queued behind them. */
  const hostUnknownEntities = new Set<string>()

  /** Pushes the outbox in chunks. Returns how many ops the host refused and
   *  this device therefore dropped, and how many are held back for a host
   *  update. The host validates a batch all-or-nothing, so a refused op used to
   *  sit at the head of the outbox and 400 every retry forever, blocking every
   *  change queued behind it. An op refused as malformed or forbidden can never
   *  be accepted later, so it is dropped and the rest of the chunk goes again.
   *  An op refused only because the host doesn't know its store yet is valid,
   *  so it is kept rather than lost to version skew. */
  async function pushOutbox(baseUrl: string, token: string | null): Promise<{ dropped: number; heldBack: number }> {
    let dropped = 0
    const pushable = () => readOutbox().filter((op) => !hostUnknownEntities.has(op.entity))
    for (let pending = pushable(); pending.length > 0; pending = pushable()) {
      const chunk = pending.slice(0, MAX_OPS_PER_PUSH)
      try {
        await deps.client.pushOps(baseUrl, chunk, token)
      } catch (e) {
        const inChunk = (i: number) => i >= 0 && i < chunk.length
        const refused = (deps.client.rejectedOpIndexes?.(e) ?? []).filter(inChunk)
        // Nothing nameable to drop means no progress is possible: surface the
        // failure as before rather than looping on it.
        if (refused.length === 0) throw e
        const unknown = new Set((deps.client.unknownEntityIndexes?.(e) ?? []).filter(inChunk))
        for (const i of unknown) hostUnknownEntities.add(chunk[i].entity)
        const ids = new Set(refused.filter((i) => !unknown.has(i)).map((i) => chunk[i].id))
        if (ids.size > 0) {
          console.warn(`sync: host refused ${ids.size} op(s); dropping them`, e)
          removeFromOutbox(ids)
          dropped += ids.size
        }
        continue
      }
      removeFromOutbox(new Set(chunk.map((op) => op.id)))
      if (chunk.length === pending.length) break
    }
    const heldBack = readOutbox().length - pushable().length
    return { dropped, heldBack }
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

  /** Pull and apply ops after `since`, one page at a time, until a page comes
   *  back short. Each page is applied (and the cursor advanced) before the
   *  next is fetched, so a long backlog that fails halfway keeps what landed.
   *  A host older than paging ignores the limit and sends everything at once;
   *  the next request then returns nothing and the loop ends. */
  async function pullOpsSince(since: number): Promise<void> {
    let cursor = since
    for (;;) {
      const page = await deps.client.fetchOpsSince(baseUrl, cursor, token)
      applyRemoteOps(page)
      if (page.length < OPS_PAGE_SIZE) return
      const last = Math.max(...page.map((op) => op.seq))
      // A page that doesn't move forward can't be followed by a different one.
      if (last <= cursor) return
      cursor = last
    }
  }

  /** The sync schema this build has, when it differs from what this device
   *  last fully synced with — set by start(), cleared once a cold run lands. */
  let schemaToRecord: string | null = null
  /** The "changes were refused" message from a run that dropped ops, kept for
   *  the cold follow-up pass that run requested. */
  let dropNotice: string | null = null

  async function runSyncNow(mode: SyncMode): Promise<void> {
    deps.status({ phase: 'syncing' })
    try {
      const wantsCold = mode === 'cold' || (mode === 'auto' && readCursor() === 0) || schemaToRecord !== null
      if (wantsCold) {
        const applied = await joinCold(baseUrl, token)
        // The snapshot had no shop data but the host is already past seq 0
        // — see joinCold's doc comment. Fall through to a full ops replay
        // from scratch instead of a snapshot that would have blanked this
        // device and skipped straight past history it never saw.
        if (!applied) await pullOpsSince(0)
      } else {
        await pullOpsSince(readCursor())
      }
      if (schemaToRecord !== null) {
        deps.storage.setItem(SCHEMA_KEY, schemaToRecord)
        schemaToRecord = null
      }
      const { dropped, heldBack } = await pushOutbox(baseUrl, token)
      // A dropped op is a local change the host will never have, so this
      // device now disagrees with it (and withoutRowsPendingLocally may have
      // skipped the host's version of that row while the op was pending).
      // Re-adopt the host's state rather than stay diverged until someone
      // happens to press Force resync.
      let notice: string | null = null
      if (dropped > 0) {
        notice = `${dropped} change(s) were refused by the host and not synced`
        // Carried through the cold pass below, which would otherwise report
        // a clean sync and wipe the notice before anyone saw it.
        dropNotice = notice
        requestFollowUp('cold')
      } else if (heldBack > 0) {
        notice = `${heldBack} change(s) are waiting for the host to be updated to this app version`
      } else {
        notice = dropNotice
        dropNotice = null
      }
      deps.status({
        phase: 'synced',
        lastSyncedAt: deps.now().toISOString(),
        pendingCount: readOutbox().length,
        lastError: notice,
      })
    } catch (e) {
      if (deps.client.isUnauthorizedError(e)) {
        deps.status({ phase: 'unauthorized', lastError: 'Wrong or missing shop password', pendingCount: readOutbox().length })
        return
      }
      deps.status({ phase: 'offline', lastError: e instanceof Error ? e.message : String(e), pendingCount: readOutbox().length })
    }
  }

  // syncNow used to have no in-flight guard at all, and it's called from
  // three independent, unsynchronized triggers: the poll timer, the SSE
  // "something changed" ping, and the push debounce. Two overlapping runs
  // read-modify-write the same storage blobs (joinCold's snapshot write and
  // applyRemoteOps's merge both do getItem -> ...await... -> setItem) with
  // no lock between them, which is a genuine lost-update window. This
  // coalesces concurrent callers onto one real run instead of starting a
  // second one: a call that arrives while a run is already in flight just
  // awaits that same run, and marks that one more pass is owed once it
  // finishes (so a change that happened *during* the in-flight run doesn't
  // get lost — it just gets picked up by the follow-up pass instead of
  // racing the current one). 'cold' wins over 'auto' if both were requested
  // for the same follow-up pass.
  let inFlight: Promise<void> | null = null
  let rerunRequested = false
  let rerunMode: SyncMode = 'auto'

  /** Owe one more pass once the current run finishes ('cold' wins over 'auto'). */
  function requestFollowUp(mode: SyncMode): void {
    rerunRequested = true
    if (mode === 'cold') rerunMode = 'cold'
  }

  async function syncNow(mode: SyncMode = 'auto'): Promise<void> {
    if (inFlight) {
      requestFollowUp(mode)
      return inFlight
    }
    rerunMode = 'auto'
    inFlight = runSyncNow(mode).finally(() => {
      inFlight = null
      if (rerunRequested) {
        rerunRequested = false
        const nextMode = rerunMode
        rerunMode = 'auto'
        void syncNow(nextMode)
      }
    })
    return inFlight
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
    // Falls back to the token already synced down in security-store when
    // this device has no explicit override of its own — see
    // hostConfig.ts's resolveAuthToken for why that's what keeps an
    // already-paired device syncing the moment the shop turns the LAN
    // token requirement on.
    token = resolveAuthToken(config)
    // A different (or since-updated) host may know stores this one refused.
    hostUnknownEntities.clear()
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

    const schema = syncSchemaFingerprint(deps.units())
    if (deps.storage.getItem(SCHEMA_KEY) !== schema) schemaToRecord = schema

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
    rejectedOpIndexes: (e) => (e instanceof RejectedOpsError ? e.indexes : null),
    unknownEntityIndexes: (e) => (e instanceof RejectedOpsError ? e.unknownEntityIndexes : null),
  },
  status: (patch) => useSyncStatusStore.getState().setStatus(patch),
  units: () => SYNC_UNITS,
  now: () => new Date(),
  // Bare references to these globals break when called as deps.setInterval(...):
  // the call site becomes a method call on `deps`, so `this` is `deps` instead of
  // `window` — and Chromium's setTimeout/setInterval/clearInterval require `this`
  // to be the real global object (a Web IDL branding check), throwing
  // "TypeError: Illegal invocation" otherwise. Wrapping in arrow functions keeps
  // the call anonymous so the engine (not `deps`) is never the receiver.
  setTimeout: (handler, timeout) => setTimeout(handler, timeout),
  setInterval: (handler, timeout) => setInterval(handler, timeout),
  clearInterval: (handle) => clearInterval(handle),
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
