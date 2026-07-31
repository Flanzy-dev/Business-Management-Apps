import { describe, it, expect } from 'vitest'
import { diffSyncUnit } from '../sync/diff'

function envelope(state: Record<string, unknown>): string {
  return JSON.stringify({ state, version: 0 })
}

describe('diffSyncUnit — list', () => {
  it('emits an upsert for a brand-new row', () => {
    const next = envelope({ customers: [{ id: 'c1', name: 'Budi' }] })
    const ops = diffSyncUnit('customer-store', 'list', 'customers', null, next, 'device-a', 't1')
    expect(ops).toEqual([
      { device: 'device-a', entity: 'customer-store', field: 'customers', entityId: 'c1', kind: 'upsert', payload: JSON.stringify({ id: 'c1', name: 'Budi' }), ts: 't1' },
    ])
  })

  it('emits an upsert only when a row actually changed', () => {
    const prev = envelope({ customers: [{ id: 'c1', name: 'Budi' }] })
    const same = envelope({ customers: [{ id: 'c1', name: 'Budi' }] })
    const changed = envelope({ customers: [{ id: 'c1', name: 'Budi S.' }] })
    expect(diffSyncUnit('customer-store', 'list', 'customers', prev, same, 'd', 't')).toEqual([])
    expect(diffSyncUnit('customer-store', 'list', 'customers', prev, changed, 'd', 't')).toHaveLength(1)
  })

  it('emits a delete for a row that disappeared', () => {
    const prev = envelope({ customers: [{ id: 'c1', name: 'Budi' }] })
    const next = envelope({ customers: [] })
    const ops = diffSyncUnit('customer-store', 'list', 'customers', prev, next, 'd', 't')
    expect(ops).toEqual([{ device: 'd', entity: 'customer-store', field: 'customers', entityId: 'c1', kind: 'delete', payload: '', ts: 't' }])
  })

  it('produces nothing for a no-op write (identical blob)', () => {
    const blob = envelope({ customers: [{ id: 'c1', name: 'Budi' }] })
    expect(diffSyncUnit('customer-store', 'list', 'customers', blob, blob, 'd', 't')).toEqual([])
  })

  it('treats a missing previous blob as an empty list (first-ever write)', () => {
    const next = envelope({ customers: [{ id: 'c1', name: 'Budi' }] })
    expect(diffSyncUnit('customer-store', 'list', 'customers', null, next, 'd', 't')).toHaveLength(1)
  })
})

describe('diffSyncUnit — append', () => {
  it('emits an append op for a new row, never a delete for a removed one', () => {
    const prev = envelope({ movements: [{ id: 'm1', delta: 5 }] })
    const next = envelope({ movements: [{ id: 'm1', delta: 5 }, { id: 'm2', delta: -2 }] })
    const ops = diffSyncUnit('stock-movement-store', 'append', 'movements', prev, next, 'd', 't')
    expect(ops).toEqual([
      { device: 'd', entity: 'stock-movement-store', field: 'movements', entityId: 'm2', kind: 'append', payload: JSON.stringify({ id: 'm2', delta: -2 }), ts: 't' },
    ])
  })

  it('an append-only unit never emits a delete even if a row vanished', () => {
    const prev = envelope({ movements: [{ id: 'm1', delta: 5 }] })
    const next = envelope({ movements: [] })
    expect(diffSyncUnit('stock-movement-store', 'append', 'movements', prev, next, 'd', 't')).toEqual([])
  })
})

describe('diffSyncUnit — singleton', () => {
  it('emits one upsert keyed by the entity itself when the value changes', () => {
    const prev = envelope({ settings: { shopName: 'A' } })
    const next = envelope({ settings: { shopName: 'B' } })
    const ops = diffSyncUnit('settings-store', 'singleton', 'settings', prev, next, 'd', 't')
    expect(ops).toEqual([
      { device: 'd', entity: 'settings-store', field: 'settings', entityId: 'settings-store', kind: 'upsert', payload: JSON.stringify({ shopName: 'B' }), ts: 't' },
    ])
  })

  it('emits nothing when the value is unchanged', () => {
    const blob = envelope({ language: 'en' })
    expect(diffSyncUnit('language-store', 'singleton', 'language', blob, blob, 'd', 't')).toEqual([])
  })
})

describe('diffSyncUnit — multiple units sharing one storage key', () => {
  it('is scoped to the itemsField it was called with, ignoring the sibling field', () => {
    const prev = envelope({ expenses: [{ id: 'e1', amount: 100 }], categories: ['Fuel'] })
    const next = envelope({ expenses: [{ id: 'e1', amount: 100 }], categories: ['Fuel', 'Parts'] })
    expect(diffSyncUnit('expense-store', 'list', 'expenses', prev, next, 'd', 't')).toEqual([])
    expect(diffSyncUnit('expense-store', 'singleton', 'categories', prev, next, 'd', 't')).toHaveLength(1)
  })
})
