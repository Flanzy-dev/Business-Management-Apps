import { describe, it, expect, beforeEach } from 'vitest'
import { startTracker, withTrackingSuppressed } from '../sync/tracker'
import { storageAdapter } from '../storageAdapter'
import { readOutbox, clearOutbox } from '../sync/outbox'

// vitest.config.ts runs this suite under environment: 'node' — see
// syncHostConfig.test.ts's header for why a minimal in-memory polyfill is
// enough here. storageAdapter's setItem wraps rawAdapter (localStorageAdapter
// under Node/browser), so triggering the tracker's onStorageSetItem hook
// means calling storageAdapter.setItem, not writing to the polyfill directly.
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

function envelope(state: Record<string, unknown>): string {
  return JSON.stringify({ state, version: 0 })
}

beforeEach(() => {
  ;(globalThis as any).localStorage = new MemoryStorage()
  clearOutbox()
  startTracker()
})

describe('startTracker', () => {
  it('turns a shop-data store write into a queued op', () => {
    storageAdapter.setItem('customer-store', envelope({ customers: [{ id: 'c1', name: 'Budi' }] }))
    const outbox = readOutbox()
    expect(outbox).toHaveLength(1)
    expect(outbox[0]).toMatchObject({ entity: 'customer-store', field: 'customers', entityId: 'c1', kind: 'upsert' })
  })

  it.each(['device-id', 'sync-host', 'sync-outbox', 'sync-cursor'])(
    'produces zero ops for a write to the device-local key %s',
    (key) => {
      storageAdapter.setItem(key, 'some-value')
      expect(readOutbox()).toEqual([])
    }
  )

  it('one write to expense-store fans out to both of its sync units (list + singleton)', () => {
    storageAdapter.setItem(
      'expense-store',
      envelope({ expenses: [{ id: 'e1', amount: 100 }], categories: [{ id: 'cat1', name: 'Rent' }] })
    )
    const outbox = readOutbox()
    const fields = outbox.map((op) => op.field).sort()
    expect(fields).toEqual(['categories', 'expenses'])
  })

  it('a no-op write (same value twice) produces nothing the second time', () => {
    const blob = envelope({ customers: [{ id: 'c1', name: 'Budi' }] })
    storageAdapter.setItem('customer-store', blob)
    clearOutbox()
    storageAdapter.setItem('customer-store', blob)
    expect(readOutbox()).toEqual([])
  })
})

describe('startTracker — removeItem (clearAllData)', () => {
  // Before onStorageRemoveItem existed, clearAllData() (src/lib/
  // persistence.ts) was invisible to sync entirely: storageAdapter fired no
  // listener on removeItem, so wiping a store locally queued zero delete
  // ops and no other device ever learned about it.
  it('turns a store removal into delete ops for every row it had', () => {
    storageAdapter.setItem('customer-store', envelope({ customers: [{ id: 'c1', name: 'Budi' }, { id: 'c2', name: 'Siti' }] }))
    clearOutbox()

    storageAdapter.removeItem('customer-store')

    const outbox = readOutbox()
    expect(outbox).toHaveLength(2)
    expect(outbox.every((op) => op.kind === 'delete' && op.entity === 'customer-store')).toBe(true)
    expect(outbox.map((op) => op.entityId).sort()).toEqual(['c1', 'c2'])
  })

  it('removing an already-empty store queues nothing', () => {
    storageAdapter.removeItem('customer-store')
    expect(readOutbox()).toEqual([])
  })

  it.each(['device-id', 'sync-host', 'sync-outbox', 'sync-cursor'])(
    'produces zero ops for removing the device-local key %s',
    (key) => {
      storageAdapter.setItem(key, 'some-value')
      clearOutbox()
      storageAdapter.removeItem(key)
      expect(readOutbox()).toEqual([])
    }
  )

  it('a removal inside withTrackingSuppressed is not queued — the engine applying a remote delete must not re-queue it', () => {
    storageAdapter.setItem('customer-store', envelope({ customers: [{ id: 'c1', name: 'Budi' }] }))
    clearOutbox()
    withTrackingSuppressed(() => {
      storageAdapter.removeItem('customer-store')
    })
    expect(readOutbox()).toEqual([])
  })
})

describe('withTrackingSuppressed', () => {
  it('suppresses ops for writes made inside it', () => {
    withTrackingSuppressed(() => {
      storageAdapter.setItem('customer-store', envelope({ customers: [{ id: 'c1', name: 'Budi' }] }))
    })
    expect(readOutbox()).toEqual([])
  })

  it('does not suppress writes made after it returns', () => {
    withTrackingSuppressed(() => {
      storageAdapter.setItem('customer-store', envelope({ customers: [{ id: 'c1', name: 'Budi' }] }))
    })
    storageAdapter.setItem('vehicle-store', envelope({ vehicles: [{ id: 'v1', make: 'Toyota' }] }))
    const outbox = readOutbox()
    expect(outbox).toHaveLength(1)
    expect(outbox[0].entity).toBe('vehicle-store')
  })

  it('nests correctly — an inner block finishing does not lift the outer block\'s suppression', () => {
    withTrackingSuppressed(() => {
      storageAdapter.setItem('customer-store', envelope({ customers: [{ id: 'c1', name: 'Budi' }] }))
      withTrackingSuppressed(() => {
        storageAdapter.setItem('vehicle-store', envelope({ vehicles: [{ id: 'v1', make: 'Toyota' }] }))
      })
      // Still inside the outer suppressed block — must still be suppressed.
      storageAdapter.setItem('worker-store', envelope({ workers: [{ id: 'w1', name: 'Tono' }] }))
    })
    expect(readOutbox()).toEqual([])

    storageAdapter.setItem('supplier-store', envelope({ suppliers: [{ id: 's1', name: 'PT Sumber' }] }))
    const outbox = readOutbox()
    expect(outbox).toHaveLength(1)
    expect(outbox[0].entity).toBe('supplier-store')
  })
})
