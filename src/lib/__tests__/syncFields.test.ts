import { describe, it, expect } from 'vitest'
import { SYNC_FIELDS, SYNC_UNIT_SPECS } from '../sync/syncFields'
import { PERSISTED_STORES } from '../storageKeys'

// Imports syncFields.ts directly, not storeRegistry.ts — the whole point of
// the split is that this file's assertions don't need storeRegistry.ts's 19
// real zustand store imports (or a localStorage polyfill for them) just to
// check the sync metadata is internally consistent.

describe('SYNC_FIELDS', () => {
  it('has an entry for every registered store — none forgotten', () => {
    for (const { storageKey } of PERSISTED_STORES) {
      expect(SYNC_FIELDS[storageKey]).toBeDefined()
    }
  })

  it('gives every store at least one field spec (an empty array reads as "forgot to wire this up")', () => {
    for (const { storageKey } of PERSISTED_STORES) {
      expect(SYNC_FIELDS[storageKey].length).toBeGreaterThan(0)
    }
  })

  it('has a unique itemsField within each store\'s spec list', () => {
    for (const { storageKey } of PERSISTED_STORES) {
      const fields = SYNC_FIELDS[storageKey].map((s) => s.itemsField)
      expect(new Set(fields).size).toBe(fields.length)
    }
  })

  it("gives expense-store its two independent fields (the one 1:N case)", () => {
    const fields = SYNC_FIELDS['expense-store'].map((s) => s.itemsField).sort()
    expect(fields).toEqual(['categories', 'expenses'])
  })

  it("marks the append-only stock ledger stores as 'append', not 'list'", () => {
    expect(SYNC_FIELDS['stock-lot-store'][0].kind).toBe('append')
    expect(SYNC_FIELDS['stock-movement-store'][0].kind).toBe('append')
  })
})

describe('SYNC_UNIT_SPECS', () => {
  it('flattens to 23 units (22 stores + expense-store\'s extra field)', () => {
    expect(SYNC_UNIT_SPECS).toHaveLength(23)
  })

  it('every unit carries its storageKey alongside kind/itemsField', () => {
    for (const unit of SYNC_UNIT_SPECS) {
      expect(unit.storageKey).toBeTruthy()
      expect(unit.itemsField).toBeTruthy()
      expect(['list', 'singleton', 'append']).toContain(unit.kind)
    }
  })
})
