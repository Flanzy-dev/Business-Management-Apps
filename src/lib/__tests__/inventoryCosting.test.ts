import { describe, it, expect } from 'vitest'
import { averageUnitCost, drawFifo, lotInventoryValue, groupLotsByProduct, LotBalance } from '../inventoryCosting'

let nextId = 1

function lot(overrides: Partial<LotBalance> = {}): LotBalance {
  const qty = overrides.qtyRemaining ?? 10
  return {
    id: `lot-${nextId++}`,
    productId: 'p-1',
    unitCost: 40_000,
    qtyRemaining: qty,
    receivedAt: '2026-01-10T00:00:00.000Z',
    ...overrides,
  }
}

/** The running example: 6 units bought at 40.000, then 10 at 55.000. */
function twoLots() {
  return [
    lot({ id: 'old', unitCost: 40_000, qtyRemaining: 6, receivedAt: '2026-01-10T00:00:00.000Z' }),
    lot({ id: 'new', unitCost: 55_000, qtyRemaining: 10, receivedAt: '2026-03-01T00:00:00.000Z' }),
  ]
}

describe('drawFifo', () => {
  it('takes from the oldest lot first', () => {
    const draw = drawFifo(twoLots(), 4)
    expect(draw.consumptions).toEqual([{ lotId: 'old', quantity: 4, unitCost: 40_000 }])
    expect(draw.cost).toBe(160_000)
    expect(draw.shortfallQty).toBe(0)
  })

  it('spans lots at different prices — the case a single cost price gets wrong', () => {
    const draw = drawFifo(twoLots(), 8)
    expect(draw.consumptions).toEqual([
      { lotId: 'old', quantity: 6, unitCost: 40_000 },
      { lotId: 'new', quantity: 2, unitCost: 55_000 },
    ])
    // 6×40.000 + 2×55.000 — not 8× either price.
    expect(draw.cost).toBe(350_000)
  })

  it('empties a lot exactly without touching the next one', () => {
    const draw = drawFifo(twoLots(), 6)
    expect(draw.consumptions).toEqual([{ lotId: 'old', quantity: 6, unitCost: 40_000 }])
    expect(draw.cost).toBe(240_000)
  })

  it('ignores lot rows that are already used up', () => {
    const lots = [
      lot({ id: 'spent', unitCost: 40_000, qtyRemaining: 0, receivedAt: '2026-01-10T00:00:00.000Z' }),
      lot({ id: 'live', unitCost: 55_000, qtyRemaining: 5, receivedAt: '2026-03-01T00:00:00.000Z' }),
    ]
    expect(drawFifo(lots, 2).consumptions).toEqual([{ lotId: 'live', quantity: 2, unitCost: 55_000 }])
  })

  it('reports what no lot could cover instead of costing it at zero', () => {
    const draw = drawFifo(twoLots(), 20)
    expect(draw.cost).toBe(790_000) // everything the lots held
    expect(draw.shortfallQty).toBe(4)
  })

  it('is all shortfall when there are no lots at all', () => {
    const draw = drawFifo([], 3)
    expect(draw).toEqual({ consumptions: [], cost: 0, shortfallQty: 3 })
  })

  it('draws nothing for a zero or negative quantity', () => {
    expect(drawFifo(twoLots(), 0).consumptions).toEqual([])
    expect(drawFifo(twoLots(), -5)).toEqual({ consumptions: [], cost: 0, shortfallQty: 0 })
  })

  it('handles fractional quantities (oil is sold by the litre)', () => {
    const draw = drawFifo([lot({ id: 'l', unitCost: 40_000, qtyRemaining: 5 })], 2.5)
    expect(draw.cost).toBe(100_000)
    expect(draw.shortfallQty).toBe(0)
  })
})

describe('lotInventoryValue', () => {
  it('values what remains, not what was received', () => {
    const lots = twoLots()
    lots[0].qtyRemaining = 0
    lots[1].qtyRemaining = 8
    expect(lotInventoryValue(lots)).toBe(440_000)
  })

  it('is zero with no lots', () => {
    expect(lotInventoryValue([])).toBe(0)
  })
})

describe('averageUnitCost', () => {
  it('blends the remaining lots by quantity', () => {
    // (6×40.000 + 10×55.000) / 16
    expect(averageUnitCost(twoLots())).toBeCloseTo(49_375)
  })

  it('is null when nothing is left, so callers can fall back rather than show 0', () => {
    expect(averageUnitCost([])).toBeNull()
    expect(averageUnitCost([lot({ qtyRemaining: 0 })])).toBeNull()
  })
})

describe('groupLotsByProduct', () => {
  it('partitions lots by productId in one pass', () => {
    const lots = [
      lot({ id: 'a', productId: 'p-1' }),
      lot({ id: 'b', productId: 'p-2' }),
      lot({ id: 'c', productId: 'p-1' }),
    ]
    const grouped = groupLotsByProduct(lots)
    expect(grouped.get('p-1')?.map((l) => l.id)).toEqual(['a', 'c'])
    expect(grouped.get('p-2')?.map((l) => l.id)).toEqual(['b'])
    expect(grouped.get('p-3')).toBeUndefined()
  })

  it('agrees with filtering + averageUnitCost per product — the refactor this backs preserves the number', () => {
    const lots = [
      ...twoLots().map((l) => ({ ...l, productId: 'p-1' })),
      lot({ id: 'other', productId: 'p-2', unitCost: 20_000, qtyRemaining: 4 }),
    ]
    const grouped = groupLotsByProduct(lots)

    for (const productId of ['p-1', 'p-2']) {
      const viaGrouping = averageUnitCost(grouped.get(productId) ?? [])
      const viaFilter = averageUnitCost(lots.filter((l) => l.productId === productId))
      expect(viaGrouping).toBe(viaFilter)
    }
  })
})
