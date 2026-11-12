import { describe, it, expect } from 'vitest'
import { createCachedAdapter, type StorageAdapter } from '../storage/storageAdapter'
import { diffSyncUnit } from '../sync/diff'

function memoryAdapter(): StorageAdapter & { data: Map<string, string>; reads: number } {
  const data = new Map<string, string>()
  const adapter = {
    data,
    reads: 0,
    getItem(key: string) {
      adapter.reads++
      return data.has(key) ? data.get(key)! : null
    },
    setItem(key: string, value: string) {
      data.set(key, value)
    },
    removeItem(key: string) {
      data.delete(key)
    },
  }
  return adapter
}

const blob = (rows: { id: string; name: string }[]) => JSON.stringify({ state: { customers: rows }, version: 0 })

describe('createCachedAdapter', () => {
  it('reads through once, then serves from memory', () => {
    const raw = memoryAdapter()
    raw.data.set('k', 'v')
    const cached = createCachedAdapter(raw)
    expect(cached.getItem('k')).toBe('v')
    expect(cached.getItem('k')).toBe('v')
    expect(raw.reads).toBe(1)
  })

  it('caches a missing key as null', () => {
    const raw = memoryAdapter()
    const cached = createCachedAdapter(raw)
    expect(cached.getItem('nope')).toBeNull()
    expect(cached.getItem('nope')).toBeNull()
    expect(raw.reads).toBe(1)
  })

  it('reflects its own writes and removals', () => {
    const raw = memoryAdapter()
    const cached = createCachedAdapter(raw)
    cached.setItem('k', 'a')
    expect(cached.getItem('k')).toBe('a')
    expect(raw.data.get('k')).toBe('a')
    cached.removeItem('k')
    expect(cached.getItem('k')).toBeNull()
    expect(raw.data.has('k')).toBe(false)
  })

  it('keeps the last stored value when the underlying write throws', () => {
    const raw = memoryAdapter()
    const cached = createCachedAdapter(raw)
    cached.setItem('k', 'good')
    raw.setItem = () => {
      throw new Error('disk full')
    }
    expect(() => cached.setItem('k', 'bad')).toThrow('disk full')
    expect(cached.getItem('k')).toBe('good')
  })

  // The shop-PC bug this exists to fix: the embedded server materializes a
  // tablet's new row straight into the shared SQLite file. The renderer, which
  // hasn't pulled that op yet, then saves the same store from its own state.
  // Diffing against the disk value made the tablet's row look deleted.
  it('ignores an external write when computing what this renderer changed', () => {
    const raw = memoryAdapter()
    const cached = createCachedAdapter(raw)
    cached.setItem('customer-store', blob([{ id: 'c1', name: 'Budi' }]))

    // The server's materializeOps, behind the renderer's back.
    raw.data.set('customer-store', blob([{ id: 'c1', name: 'Budi' }, { id: 'tablet-row', name: 'Sari' }]))

    // The renderer edits c1 from its own (pre-pull) state.
    const prev = cached.getItem('customer-store')
    const next = blob([{ id: 'c1', name: 'Budi Santoso' }])
    const ops = diffSyncUnit('customer-store', 'list', 'customers', prev, next, 'shop-pc', '2026-10-24T00:00:00.000Z')

    expect(ops.map((op) => [op.kind, op.entityId])).toEqual([['upsert', 'c1']])
  })
})

describe('isQuotaExceededError', () => {
  it('recognizes the browser shapes of a full storage quota', async () => {
    const { isQuotaExceededError } = await import('../storage/storageAdapter')
    expect(isQuotaExceededError({ name: 'QuotaExceededError' })).toBe(true)
    expect(isQuotaExceededError({ name: 'NS_ERROR_DOM_QUOTA_REACHED' })).toBe(true)
    expect(isQuotaExceededError({ code: 22 })).toBe(true)
    expect(isQuotaExceededError(new Error('disk full'))).toBe(false)
    expect(isQuotaExceededError(null)).toBe(false)
  })
})
