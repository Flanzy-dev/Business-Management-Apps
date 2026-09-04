import { describe, it, expect, beforeEach } from 'vitest'
import { readQuarantine, quarantineOp, clearQuarantine } from '../sync/quarantine'
import type { SyncOpWithSeq } from '../sync/types'

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

function op(overrides: Partial<SyncOpWithSeq> = {}): SyncOpWithSeq {
  return {
    seq: 1,
    id: 'op-1',
    device: 'device-a',
    entity: 'customer-store',
    field: 'customers',
    entityId: 'c1',
    kind: 'upsert',
    payload: 'not valid json',
    ts: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('readQuarantine', () => {
  it('is empty when nothing has been quarantined', () => {
    expect(readQuarantine()).toEqual([])
  })

  it('ignores corrupted storage and falls back to empty', () => {
    localStorage.setItem('sync-quarantine', 'not json')
    expect(readQuarantine()).toEqual([])
  })
})

describe('quarantineOp', () => {
  it('records the op, the reason, and a timestamp', () => {
    quarantineOp(op({ id: 'op-1' }), 'Unexpected token')
    const entries = readQuarantine()
    expect(entries).toHaveLength(1)
    expect(entries[0].op.id).toBe('op-1')
    expect(entries[0].reason).toBe('Unexpected token')
    expect(typeof entries[0].quarantinedAt).toBe('string')
  })

  it('appends to whatever was already quarantined', () => {
    quarantineOp(op({ id: 'op-1' }), 'reason-1')
    quarantineOp(op({ id: 'op-2' }), 'reason-2')
    expect(readQuarantine().map((e) => e.op.id)).toEqual(['op-1', 'op-2'])
  })

  it('caps the list instead of growing without bound', () => {
    for (let i = 0; i < 250; i++) quarantineOp(op({ id: `op-${i}` }), 'reason')
    const entries = readQuarantine()
    expect(entries.length).toBeLessThanOrEqual(200)
    // Keeps the most recent, not the oldest.
    expect(entries[entries.length - 1].op.id).toBe('op-249')
  })
})

describe('clearQuarantine', () => {
  it('discards everything recorded', () => {
    quarantineOp(op({ id: 'op-1' }), 'reason')
    clearQuarantine()
    expect(readQuarantine()).toEqual([])
  })
})
