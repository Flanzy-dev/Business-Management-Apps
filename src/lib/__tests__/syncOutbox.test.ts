import { describe, it, expect, beforeEach } from 'vitest'
import { readOutbox, enqueueOps, removeFromOutbox, clearOutbox } from '../sync/outbox'
import type { SyncOp } from '../sync/types'

// vitest.config.ts runs this suite under environment: 'node' — see
// syncHostConfig.test.ts's header for why a minimal in-memory polyfill is
// enough here.
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

beforeEach(() => {
  ;(globalThis as any).localStorage = new MemoryStorage()
})

function op(overrides: Partial<SyncOp> = {}): SyncOp {
  return {
    id: 'op-1',
    device: 'device-a',
    entity: 'customer-store',
    field: 'customers',
    entityId: 'c1',
    kind: 'upsert',
    payload: '{}',
    ts: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('readOutbox', () => {
  it('is empty when nothing has been written', () => {
    expect(readOutbox()).toEqual([])
  })

  it('ignores corrupted storage and falls back to empty', () => {
    localStorage.setItem('sync-outbox', 'not json')
    expect(readOutbox()).toEqual([])
  })

  it('ignores storage that parses but is not an array', () => {
    localStorage.setItem('sync-outbox', '{"not":"an array"}')
    expect(readOutbox()).toEqual([])
  })
})

describe('enqueueOps', () => {
  it('appends to whatever was already queued', () => {
    enqueueOps([op({ id: 'op-1' })])
    enqueueOps([op({ id: 'op-2' })])
    expect(readOutbox().map((o) => o.id)).toEqual(['op-1', 'op-2'])
  })

  it('is a no-op for an empty batch', () => {
    enqueueOps([op({ id: 'op-1' })])
    enqueueOps([])
    expect(readOutbox()).toHaveLength(1)
  })
})

describe('removeFromOutbox', () => {
  it('drops only the accepted ids, keeping the rest queued', () => {
    enqueueOps([op({ id: 'op-1' }), op({ id: 'op-2' }), op({ id: 'op-3' })])
    removeFromOutbox(new Set(['op-1', 'op-3']))
    expect(readOutbox().map((o) => o.id)).toEqual(['op-2'])
  })
})

describe('clearOutbox', () => {
  it('discards everything queued', () => {
    enqueueOps([op({ id: 'op-1' }), op({ id: 'op-2' })])
    clearOutbox()
    expect(readOutbox()).toEqual([])
  })
})
