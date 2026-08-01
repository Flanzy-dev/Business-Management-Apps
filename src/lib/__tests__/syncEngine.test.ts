import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createSyncEngine, type SyncClient, type SyncEngineDeps } from '../sync/engine'
import { storageAdapter } from '../storageAdapter'
import { readOutbox, enqueueOps } from '../sync/outbox'
import { writeHostConfig } from '../sync/hostConfig'
import type { SyncUnit } from '../sync/storeRegistry'
import type { SyncStatusState } from '../../store/syncStatusStore'

// createSyncEngine() takes every real dependency as a parameter instead of
// reaching for module-level singletons — see engine.ts's header. That's what
// makes this file possible: no network, no browser, no real localStorage.
//
// deps.storage is deliberately the REAL storageAdapter singleton, not a
// separate fake — src/lib/sync/outbox.ts and src/lib/sync/hostConfig.ts
// aren't parameterized (engine.ts calls them directly, same as before), so
// they always go through storageAdapter's own rawAdapter -> global
// localStorage. Passing the same real storageAdapter as deps.storage makes
// every piece of the engine share one consistent in-memory backing store per
// test, via the localStorage polyfill below — the same pattern
// syncHostConfig.test.ts already established for hostConfig.ts alone.
class MemoryStorage {
  private store = new Map<string, string>()
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value)
  }
  removeItem(key: string): void {
    this.store.delete(key)
  }
}

class FakeUnauthorizedError extends Error {}

function envelope(state: Record<string, unknown>): string {
  return JSON.stringify({ state, version: 0 })
}

function createStatusSink() {
  const patches: Partial<SyncStatusState>[] = []
  let state: Partial<SyncStatusState> = {}
  const sink = (patch: Partial<SyncStatusState>) => {
    patches.push(patch)
    state = { ...state, ...patch }
  }
  return { sink, patches, get state() { return state } }
}

function createFakeClient(overrides: Partial<SyncClient> = {}): SyncClient {
  return {
    fetchSnapshot: async () => ({ data: {}, seq: 0 }),
    fetchOpsSince: async () => [],
    pushOps: async () => ({ seqs: [] }),
    openEventStream: () => () => {},
    isUnauthorizedError: (e) => e instanceof FakeUnauthorizedError,
    ...overrides,
  }
}

/** A single 'customer-store' sync unit — enough for every test below, and
 *  far cheaper than storeRegistry.ts's real 19-store list. */
function createUnits(): { units: () => readonly SyncUnit[]; rehydrate: ReturnType<typeof vi.fn> } {
  const rehydrate = vi.fn()
  const units: SyncUnit[] = [{ storageKey: 'customer-store', kind: 'list', itemsField: 'customers', rehydrate }]
  return { units: () => units, rehydrate }
}

function createEngine(clientOverrides: Partial<SyncClient> = {}) {
  const client = createFakeClient(clientOverrides)
  const status = createStatusSink()
  const { units, rehydrate } = createUnits()
  const deps: SyncEngineDeps = {
    storage: storageAdapter,
    client,
    status: status.sink,
    units,
    now: () => new Date('2026-01-01T00:00:00.000Z'),
    setTimeout,
    setInterval,
    clearInterval,
  }
  return { engine: createSyncEngine(deps), client, status, rehydrate }
}

beforeEach(() => {
  ;(globalThis as any).localStorage = new MemoryStorage()
})

describe('syncNow — cold join', () => {
  it('writes shop-data keys from the snapshot and advances the cursor', async () => {
    const { engine, status } = createEngine({
      fetchSnapshot: async () => ({ data: { 'customer-store': envelope({ customers: [{ id: 'c1', name: 'Budi' }] }) }, seq: 3 }),
    })
    await engine.syncNow('cold')
    expect(storageAdapter.getItem('customer-store')).toBe(envelope({ customers: [{ id: 'c1', name: 'Budi' }] }))
    expect(storageAdapter.getItem('sync-cursor')).toBe('3')
    expect(status.state.phase).toBe('synced')
  })

  it('never overwrites this device\'s own device-local keys, even when the snapshot contains them', async () => {
    storageAdapter.setItem('device-id', 'local-device-id')
    const { engine } = createEngine({
      fetchSnapshot: async () => ({
        data: {
          'customer-store': envelope({ customers: [] }),
          'device-id': 'host-device-id',
          'sync-host': '{"role":"main"}',
          'sync-outbox': '[]',
        },
        seq: 1,
      }),
    })
    await engine.syncNow('cold')
    // The regression this guards: joinCold used to write the whole snapshot
    // unfiltered, so this device would have adopted the host's device-id —
    // misattributing every StockMovement it writes afterward.
    expect(storageAdapter.getItem('device-id')).toBe('local-device-id')
    expect(storageAdapter.getItem('sync-host')).toBeNull()
  })

  it('removes a local shop-data key the snapshot does not contain — the snapshot is authoritative', async () => {
    storageAdapter.setItem('vehicle-store', envelope({ vehicles: [{ id: 'v1' }] }))
    const { engine } = createEngine({
      fetchSnapshot: async () => ({ data: { 'customer-store': envelope({ customers: [] }) }, seq: 1 }),
    })
    await engine.syncNow('cold')
    expect(storageAdapter.getItem('vehicle-store')).toBeNull()
  })

  it('rehydrates every sync unit after applying the snapshot', async () => {
    const { engine, rehydrate } = createEngine({
      fetchSnapshot: async () => ({ data: { 'customer-store': envelope({ customers: [] }) }, seq: 1 }),
    })
    await engine.syncNow('cold')
    expect(rehydrate).toHaveBeenCalled()
  })
})

describe('syncNow — empty-snapshot cursor guard (Fix 4a)', () => {
  it('does not jump the cursor to the host\'s seq when the snapshot has no shop data', async () => {
    const { engine } = createEngine({
      fetchSnapshot: async () => ({ data: {}, seq: 5 }),
      fetchOpsSince: async () => [],
    })
    await engine.syncNow('cold')
    // Pre-fix this would have written cursor '5' directly from joinCold,
    // permanently skipping ops 1-5 this device never actually replayed.
    expect(storageAdapter.getItem('sync-cursor')).toBeNull()
  })

  it('falls through to a full ops replay instead, and the cursor reflects what was actually replayed', async () => {
    const { engine } = createEngine({
      fetchSnapshot: async () => ({ data: {}, seq: 5 }),
      fetchOpsSince: async (_baseUrl, since) => {
        expect(since).toBe(0) // replays from scratch, not from the stale local cursor
        return [
          { id: 'op-1', device: 'dev-a', entity: 'customer-store', field: 'customers', entityId: 'c1', kind: 'upsert', payload: JSON.stringify({ id: 'c1', name: 'Budi' }), ts: '2026-01-01T00:00:00.000Z', seq: 2 },
        ]
      },
    })
    await engine.syncNow('cold')
    expect(storageAdapter.getItem('sync-cursor')).toBe('2')
    expect(storageAdapter.getItem('customer-store')).toBe(envelope({ customers: [{ id: 'c1', name: 'Budi' }] }))
  })
})

describe('syncNow — catch-up', () => {
  it('applies incoming ops and advances the cursor to the highest seq', async () => {
    storageAdapter.setItem('sync-cursor', '10')
    const { engine } = createEngine({
      fetchOpsSince: async (_baseUrl, since) => {
        expect(since).toBe(10)
        return [
          { id: 'op-1', device: 'dev-a', entity: 'customer-store', field: 'customers', entityId: 'c1', kind: 'upsert', payload: JSON.stringify({ id: 'c1', name: 'First' }), ts: '2026-01-01T00:00:00.000Z', seq: 11 },
          { id: 'op-2', device: 'dev-a', entity: 'customer-store', field: 'customers', entityId: 'c1', kind: 'upsert', payload: JSON.stringify({ id: 'c1', name: 'Second' }), ts: '2026-01-01T00:00:00.000Z', seq: 12 },
        ]
      },
    })
    await engine.syncNow('auto')
    expect(storageAdapter.getItem('sync-cursor')).toBe('12')
    expect(storageAdapter.getItem('customer-store')).toBe(envelope({ customers: [{ id: 'c1', name: 'Second' }] }))
  })
})

describe('syncNow — failure handling', () => {
  it('reports offline and keeps the outbox on a push failure', async () => {
    enqueueOps([{ id: 'op-1', device: 'dev-a', entity: 'customer-store', field: 'customers', entityId: 'c1', kind: 'upsert', payload: '{}', ts: '2026-01-01T00:00:00.000Z' }])
    const { engine, status } = createEngine({
      pushOps: async () => { throw new Error('network down') },
    })
    await engine.syncNow('cold')
    expect(status.state.phase).toBe('offline')
    expect(readOutbox()).toHaveLength(1)
  })

  it('maps an UnauthorizedError to the unauthorized phase, distinct from a generic offline error', async () => {
    const { engine, status } = createEngine({
      fetchSnapshot: async () => { throw new FakeUnauthorizedError('nope') },
    })
    await engine.syncNow('cold')
    expect(status.state.phase).toBe('unauthorized')
  })
})

describe('forceResync', () => {
  it('resets the cursor via a real cold join, and never explicitly discards the outbox', async () => {
    storageAdapter.setItem('sync-cursor', '99')
    enqueueOps([{ id: 'op-1', device: 'dev-a', entity: 'customer-store', field: 'customers', entityId: 'c1', kind: 'upsert', payload: '{}', ts: '2026-01-01T00:00:00.000Z' }])
    const { engine, status } = createEngine({
      fetchSnapshot: async () => ({ data: { 'customer-store': envelope({ customers: [] }) }, seq: 1 }),
      // Push failing (unrelated to the cold join, which happens first and
      // succeeds regardless) is what isolates "forceResync doesn't call
      // clearOutbox" from "a successful push naturally removes now-sent
      // ops" — the latter is correct behavior, not something to guard here.
      pushOps: async () => { throw new Error('push unrelated to this test') },
    })
    engine.forceResync()
    await vi.waitFor(() => expect(status.state.phase).toBe('offline'))
    expect(storageAdapter.getItem('sync-cursor')).toBe('1')
    expect(readOutbox()).toHaveLength(1)
  })

  it('removes a local store the host has never written, same as a real cold join', async () => {
    storageAdapter.setItem('vehicle-store', envelope({ vehicles: [{ id: 'v1' }] }))
    const { engine, status } = createEngine({
      fetchSnapshot: async () => ({ data: { 'customer-store': envelope({ customers: [] }) }, seq: 1 }),
    })
    engine.forceResync()
    await vi.waitFor(() => expect(status.state.phase).toBe('synced'))
    expect(storageAdapter.getItem('vehicle-store')).toBeNull()
  })
})

describe('switchHost', () => {
  it('clears the outbox — pending ops belonged to the host being left', async () => {
    enqueueOps([{ id: 'op-1', device: 'dev-a', entity: 'customer-store', field: 'customers', entityId: 'c1', kind: 'upsert', payload: '{}', ts: '2026-01-01T00:00:00.000Z' }])
    const { engine, status } = createEngine({
      fetchSnapshot: async () => ({ data: {}, seq: 0 }),
    })
    engine.switchHost({ role: 'follower', host: '192.168.1.50', token: null })
    await vi.waitFor(() => expect(status.state.phase).toBe('synced'))
    expect(readOutbox()).toEqual([])
  })

  it('does not touch local data when the new host is unreachable — fetch-then-apply, not wipe-then-fetch', async () => {
    storageAdapter.setItem('customer-store', envelope({ customers: [{ id: 'c1', name: 'Budi' }] }))
    storageAdapter.setItem('sync-cursor', '7')
    const { engine, status } = createEngine({
      fetchSnapshot: async () => { throw new Error('host unreachable') },
    })
    engine.switchHost({ role: 'follower', host: '10.0.0.99', token: null })
    await vi.waitFor(() => expect(status.state.phase).toBe('offline'))
    // Pre-fix, switchHost wiped every store before ever contacting the new
    // host — a dead host left the device with zero data and no recovery
    // path. Nothing here should have been touched.
    expect(storageAdapter.getItem('customer-store')).toBe(envelope({ customers: [{ id: 'c1', name: 'Budi' }] }))
  })

  it('adopts a different remote host\'s data, removing what that host never wrote', async () => {
    storageAdapter.setItem('customer-store', envelope({ customers: [{ id: 'c1', name: 'Stale local customer' }] }))
    const { engine, status } = createEngine({
      fetchSnapshot: async () => ({ data: { 'vehicle-store': envelope({ vehicles: [{ id: 'v1' }] }) }, seq: 1 }),
    })
    engine.switchHost({ role: 'follower', host: '192.168.1.50', token: null })
    await vi.waitFor(() => expect(status.state.phase).toBe('synced'))
    expect(storageAdapter.getItem('customer-store')).toBeNull()
    expect(storageAdapter.getItem('vehicle-store')).toBe(envelope({ vehicles: [{ id: 'v1' }] }))
  })

  it('switching back to role main is self-referential and does not lose local data', async () => {
    storageAdapter.setItem('customer-store', envelope({ customers: [{ id: 'c1', name: 'Budi' }] }))
    writeHostConfig({ role: 'follower', host: '192.168.1.50', token: null })
    const { engine, status } = createEngine({
      // On the real shop PC this snapshot IS this device's own data (same
      // SQLite file) — simulated here by returning exactly what's local.
      fetchSnapshot: async () => ({ data: { 'customer-store': envelope({ customers: [{ id: 'c1', name: 'Budi' }] }) }, seq: 1 }),
    })
    engine.switchHost({ role: 'main', host: null, token: null })
    await vi.waitFor(() => expect(status.state.phase).toBe('synced'))
    expect(storageAdapter.getItem('customer-store')).toBe(envelope({ customers: [{ id: 'c1', name: 'Budi' }] }))
  })
})

describe('start / stop', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('polls on an interval while running', async () => {
    storageAdapter.setItem('sync-cursor', '5') // already synced once -> auto mode takes the catch-up branch
    const fetchOpsSince = vi.fn(async () => [])
    const { engine } = createEngine({ fetchOpsSince })
    engine.start()
    await vi.advanceTimersByTimeAsync(0) // the immediate first sync in start()
    const callsAfterStart = fetchOpsSince.mock.calls.length
    await vi.advanceTimersByTimeAsync(15_000)
    expect(fetchOpsSince.mock.calls.length).toBeGreaterThan(callsAfterStart)
    engine.stop()
  })

  it('stop() clears the poll interval — no more syncs happen afterward', async () => {
    storageAdapter.setItem('sync-cursor', '5')
    const fetchOpsSince = vi.fn(async () => [])
    const { engine } = createEngine({ fetchOpsSince })
    engine.start()
    await vi.advanceTimersByTimeAsync(0)
    engine.stop()
    const callsAfterStop = fetchOpsSince.mock.calls.length
    await vi.advanceTimersByTimeAsync(60_000)
    expect(fetchOpsSince.mock.calls.length).toBe(callsAfterStop)
  })

  it('start() is idempotent — calling it twice does not double the poll rate', async () => {
    storageAdapter.setItem('sync-cursor', '5')
    const fetchOpsSince = vi.fn(async () => [])
    const { engine } = createEngine({ fetchOpsSince })
    engine.start()
    engine.start()
    await vi.advanceTimersByTimeAsync(0)
    const callsAfterStart = fetchOpsSince.mock.calls.length
    await vi.advanceTimersByTimeAsync(15_000)
    // Exactly one more sync from exactly one interval, not two.
    expect(fetchOpsSince.mock.calls.length).toBe(callsAfterStart + 1)
    engine.stop()
  })
})
