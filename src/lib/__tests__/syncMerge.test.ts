import { describe, it, expect } from 'vitest'
import { applyOpsToBlob } from '../sync/merge'
import type { SyncOpWithSeq } from '../sync/types'

let nextSeq = 1

function op(overrides: Partial<SyncOpWithSeq> = {}): SyncOpWithSeq {
  return {
    seq: nextSeq++,
    id: `op-${nextSeq}`,
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

function envelope(state: Record<string, unknown>): string {
  return JSON.stringify({ state, version: 0 })
}

function readField(blob: string, field: string): unknown {
  return JSON.parse(blob).state[field]
}

describe('applyOpsToBlob — list', () => {
  it('inserts a new row from an upsert op', () => {
    const result = applyOpsToBlob('list', 'customers', null, [
      op({ entityId: 'c1', kind: 'upsert', payload: JSON.stringify({ id: 'c1', name: 'Budi' }) }),
    ])
    expect(readField(result, 'customers')).toEqual([{ id: 'c1', name: 'Budi' }])
  })

  it('replaces an existing row on upsert', () => {
    const current = envelope({ customers: [{ id: 'c1', name: 'Budi' }] })
    const result = applyOpsToBlob('list', 'customers', current, [
      op({ entityId: 'c1', kind: 'upsert', payload: JSON.stringify({ id: 'c1', name: 'Budi S.' }) }),
    ])
    expect(readField(result, 'customers')).toEqual([{ id: 'c1', name: 'Budi S.' }])
  })

  it('removes a row on delete', () => {
    const current = envelope({ customers: [{ id: 'c1', name: 'Budi' }, { id: 'c2', name: 'Siti' }] })
    const result = applyOpsToBlob('list', 'customers', current, [op({ entityId: 'c1', kind: 'delete', payload: '' })])
    expect(readField(result, 'customers')).toEqual([{ id: 'c2', name: 'Siti' }])
  })

  it('applies ops in the given order — the last op for an id wins regardless of ts', () => {
    // seq order is what matters, not wall-clock ts — see merge.ts's header note.
    const ops = [
      op({ seq: 1, entityId: 'c1', kind: 'upsert', payload: JSON.stringify({ id: 'c1', name: 'First' }), ts: '2026-06-01T00:00:00.000Z' }),
      op({ seq: 2, entityId: 'c1', kind: 'upsert', payload: JSON.stringify({ id: 'c1', name: 'Second' }), ts: '2026-01-01T00:00:00.000Z' }),
    ]
    const result = applyOpsToBlob('list', 'customers', null, ops)
    expect(readField(result, 'customers')).toEqual([{ id: 'c1', name: 'Second' }])
  })

  it('is a safe no-op applying zero ops to an empty blob', () => {
    const result = applyOpsToBlob('list', 'customers', null, [])
    expect(readField(result, 'customers')).toEqual([])
  })

  it('stamps a freshly-fabricated envelope with the given freshVersion, not 0', () => {
    // Regression coverage for the corruption this parameter exists to
    // prevent: a store this device has no local blob for yet (currentBlob
    // === null) used to always get `version: 0` baked in, which made
    // zustand's persist run every version-to-version migration on the very
    // next rehydrate — including on rows already in the current shape. See
    // STORE_VERSIONS's doc comment in ../sync/syncFields.ts.
    const result = applyOpsToBlob(
      'list',
      'workOrders',
      null,
      [op({ entity: 'work-order-store', field: 'workOrders', entityId: 'wo1', kind: 'upsert', payload: JSON.stringify({ id: 'wo1' }) })],
      2
    )
    expect(JSON.parse(result).version).toBe(2)
  })

  it('defaults freshVersion to 0 when the caller omits it', () => {
    const result = applyOpsToBlob('list', 'customers', null, [])
    expect(JSON.parse(result).version).toBe(0)
  })

  it('leaves an existing envelope\'s version alone regardless of freshVersion', () => {
    // freshVersion only governs a brand-new envelope — an existing blob's
    // version must never be overwritten by a merge, versioned or not.
    const current = JSON.stringify({ state: { customers: [] }, version: 5 })
    const result = applyOpsToBlob('list', 'customers', current, [], 2)
    expect(JSON.parse(result).version).toBe(5)
  })
})

describe('applyOpsToBlob — append', () => {
  it('inserts a row once', () => {
    const result = applyOpsToBlob('append', 'movements', null, [
      op({ entity: 'stock-movement-store', field: 'movements', entityId: 'm1', kind: 'append', payload: JSON.stringify({ id: 'm1', delta: 5 }) }),
    ])
    expect(readField(result, 'movements')).toEqual([{ id: 'm1', delta: 5 }])
  })

  it('re-delivering the same append is a no-op, not a duplicate', () => {
    const current = envelope({ movements: [{ id: 'm1', delta: 5 }] })
    const result = applyOpsToBlob('append', 'movements', current, [
      op({ entity: 'stock-movement-store', field: 'movements', entityId: 'm1', kind: 'append', payload: JSON.stringify({ id: 'm1', delta: 999 }) }),
    ])
    // The already-present row wins — an append never overwrites.
    expect(readField(result, 'movements')).toEqual([{ id: 'm1', delta: 5 }])
  })

  it('two devices appending different rows both survive', () => {
    const current = envelope({ movements: [{ id: 'm1', delta: 5 }] })
    const result = applyOpsToBlob('append', 'movements', current, [
      op({ entity: 'stock-movement-store', field: 'movements', entityId: 'm2', kind: 'append', payload: JSON.stringify({ id: 'm2', delta: -3 }), device: 'device-a' }),
      op({ entity: 'stock-movement-store', field: 'movements', entityId: 'm3', kind: 'append', payload: JSON.stringify({ id: 'm3', delta: -2 }), device: 'device-b' }),
    ])
    expect(readField(result, 'movements')).toEqual([
      { id: 'm1', delta: 5 },
      { id: 'm2', delta: -3 },
      { id: 'm3', delta: -2 },
    ])
  })
})

describe('applyOpsToBlob — singleton', () => {
  it('replaces the whole value on upsert', () => {
    const current = envelope({ settings: { shopName: 'A' } })
    const result = applyOpsToBlob('singleton', 'settings', current, [
      op({ entity: 'settings-store', field: 'settings', entityId: 'settings-store', kind: 'upsert', payload: JSON.stringify({ shopName: 'B' }) }),
    ])
    expect(readField(result, 'settings')).toEqual({ shopName: 'B' })
  })

  it('the last of several upserts in the batch wins', () => {
    const ops = [
      op({ entity: 'settings-store', field: 'settings', entityId: 'settings-store', kind: 'upsert', payload: JSON.stringify({ shopName: 'A' }) }),
      op({ entity: 'settings-store', field: 'settings', entityId: 'settings-store', kind: 'upsert', payload: JSON.stringify({ shopName: 'B' }) }),
    ]
    const result = applyOpsToBlob('singleton', 'settings', null, ops)
    expect(readField(result, 'settings')).toEqual({ shopName: 'B' })
  })
})

describe('applyOpsToBlob — determinism', () => {
  it('gives the same end state regardless of which device computes the merge', () => {
    // The property multi-device sync rests on: every device replays the same
    // ops in the same seq order and lands on the same state.
    const ops = [
      op({ seq: 1, entityId: 'c1', kind: 'upsert', payload: JSON.stringify({ id: 'c1', name: 'A' }) }),
      op({ seq: 2, entityId: 'c1', kind: 'upsert', payload: JSON.stringify({ id: 'c1', name: 'B' }) }),
      op({ seq: 3, entityId: 'c2', kind: 'upsert', payload: JSON.stringify({ id: 'c2', name: 'C' }) }),
      op({ seq: 4, entityId: 'c1', kind: 'delete', payload: '' }),
    ]
    const resultA = applyOpsToBlob('list', 'customers', null, ops)
    const resultB = applyOpsToBlob('list', 'customers', envelope({ customers: [] }), ops)
    expect(readField(resultA, 'customers')).toEqual(readField(resultB, 'customers'))
    expect(readField(resultA, 'customers')).toEqual([{ id: 'c2', name: 'C' }])
  })
})
