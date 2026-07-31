import { describe, it, expect } from 'vitest'
import { buildLedgerBackfill, LegacyProduct, LegacyStockLot } from '../stockLedgerBackfill'
import { qtyOnHand } from '../stockLedger'
import type { StockMovement } from '../../store/stockMovementStore'

let nextId = 1

function product(overrides: Partial<LegacyProduct> = {}): LegacyProduct {
  return {
    id: `p-${nextId++}`,
    costPrice: 40_000,
    createdAt: '2026-01-01T00:00:00.000Z',
    qtyOnHand: 0,
    ...overrides,
  }
}

function lot(overrides: Partial<LegacyStockLot> = {}): LegacyStockLot {
  return {
    id: `lot-${nextId++}`,
    productId: 'p-1',
    unitCost: 40_000,
    receivedAt: '2026-01-10T00:00:00.000Z',
    qtyRemaining: 0,
    ...overrides,
  }
}

/** Total derived quantity a backfill result would produce, as a plain movement array. */
function derivedQty(result: ReturnType<typeof buildLedgerBackfill>, productId: string): number {
  const withIds: StockMovement[] = [
    ...result.openings.map((o, i) => ({
      ...o.movement,
      lotId: `generated-${i}`,
      id: `m-${i}`,
      deviceId: 'd',
      createdAt: '',
    })),
    ...result.movements.map((m, i) => ({ ...m, id: `m2-${i}`, deviceId: 'd', createdAt: '' })),
  ]
  return qtyOnHand(withIds, productId)
}

describe('buildLedgerBackfill', () => {
  it('opens a brand-new lot for stock that never had one at all', () => {
    const p = product({ id: 'p-1', qtyOnHand: 6, costPrice: 40_000 })
    const result = buildLedgerBackfill([p], [])
    expect(result.openings).toEqual([
      {
        lot: { productId: 'p-1', unitCost: 40_000, qtyReceived: 6, receivedAt: p.createdAt, expenseId: null },
        movement: {
          productId: 'p-1',
          delta: 6,
          reason: 'opening',
          unitCost: 40_000,
          refType: null,
          refId: null,
          occurredAt: p.createdAt,
        },
      },
    ])
    expect(result.movements).toEqual([])
    expect(derivedQty(result, 'p-1')).toBe(6)
  })

  it('does nothing for a product with no stock and no lots', () => {
    const p = product({ id: 'p-1', qtyOnHand: 0 })
    expect(buildLedgerBackfill([p], [])).toEqual({ openings: [], movements: [] })
  })

  it('carries an existing lot forward as one opening movement, not a new lot', () => {
    const p = product({ id: 'p-1', qtyOnHand: 6 })
    const l = lot({ id: 'lot-a', productId: 'p-1', qtyRemaining: 6, unitCost: 40_000, receivedAt: '2026-01-05T00:00:00.000Z' })
    const result = buildLedgerBackfill([p], [l])
    expect(result.openings).toEqual([])
    expect(result.movements).toEqual([
      { productId: 'p-1', delta: 6, reason: 'opening', lotId: 'lot-a', unitCost: 40_000, refType: null, refId: null, occurredAt: l.receivedAt },
    ])
    expect(derivedQty(result, 'p-1')).toBe(6)
  })

  it('splits across several existing lots, matching legacy total exactly', () => {
    const p = product({ id: 'p-1', qtyOnHand: 16 })
    const lots = [
      lot({ id: 'old', productId: 'p-1', qtyRemaining: 6, unitCost: 40_000, receivedAt: '2026-01-01T00:00:00.000Z' }),
      lot({ id: 'new', productId: 'p-1', qtyRemaining: 10, unitCost: 55_000, receivedAt: '2026-03-01T00:00:00.000Z' }),
    ]
    const result = buildLedgerBackfill([p], lots)
    expect(result.movements).toHaveLength(2)
    expect(derivedQty(result, 'p-1')).toBe(16)
  })

  it('reconciles with an unattributed movement when lots undercount the legacy total (drift)', () => {
    // e.g. a "subtract" adjustment once removed more than its lots held.
    const p = product({ id: 'p-1', qtyOnHand: 10 })
    const l = lot({ id: 'lot-a', productId: 'p-1', qtyRemaining: 6, unitCost: 40_000 })
    const result = buildLedgerBackfill([p], [l])
    expect(result.openings).toEqual([])
    // The lot's own movement, plus one unattributed reconciling movement for the gap.
    expect(result.movements).toHaveLength(2)
    const reconciling = result.movements.find(m => m.lotId === null)
    expect(reconciling).toMatchObject({ productId: 'p-1', delta: 4 })
    expect(derivedQty(result, 'p-1')).toBe(10)
  })

  it('reconciles with a negative unattributed movement when lots overcount the legacy total', () => {
    const p = product({ id: 'p-1', qtyOnHand: 4 })
    const l = lot({ id: 'lot-a', productId: 'p-1', qtyRemaining: 6, unitCost: 40_000 })
    const result = buildLedgerBackfill([p], [l])
    const reconciling = result.movements.find(m => m.lotId === null)
    expect(reconciling).toMatchObject({ delta: -2 })
    expect(derivedQty(result, 'p-1')).toBe(4)
  })

  it('treats a missing legacy qtyOnHand as zero rather than throwing', () => {
    const p: LegacyProduct = { id: 'p-1', costPrice: 1000, createdAt: '2026-01-01T00:00:00.000Z' }
    expect(buildLedgerBackfill([p], [])).toEqual({ openings: [], movements: [] })
  })

  it('is a safe no-op for a brand-new install (no products, no lots)', () => {
    expect(buildLedgerBackfill([], [])).toEqual({ openings: [], movements: [] })
  })
})
