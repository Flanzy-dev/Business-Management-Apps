// Fractional litres: the float error that used to refuse the last 0.8 L of a
// 3 L drum, and leave a drained product reading 1e-16 oversold.
import { describe, expect, it } from 'vitest'
import { parseQty, roundQty } from '../inventory/quantity'
import { drawFifo, type LotBalance } from '../inventory/inventoryCosting'
import { hydrateLots, qtyByProduct, qtyOnHand } from '../inventory/stockLedger'
import { firstInsufficientStockProduct } from '../orders/orderLifecycle'
import type { StockLot } from '../../store/stockLotStore'
import type { StockMovement } from '../../store/stockMovementStore'

function movement(delta: number, overrides: Partial<StockMovement> = {}): StockMovement {
  return {
    id: `m-${Math.random()}`,
    productId: 'oil',
    delta,
    reason: 'adjustment',
    occurredAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  } as StockMovement
}

describe('roundQty', () => {
  it('removes binary float noise', () => {
    expect(3 - 2.2).not.toBe(0.8)
    expect(roundQty(3 - 2.2)).toBe(0.8)
  })

  it('never returns -0', () => {
    expect(Object.is(roundQty(-1e-12), 0)).toBe(true)
    expect(Object.is(roundQty(-0), 0)).toBe(true)
  })

  it('leaves whole and 3-decimal quantities alone', () => {
    expect(roundQty(12)).toBe(12)
    expect(roundQty(-4)).toBe(-4)
    expect(roundQty(2.125)).toBe(2.125)
  })
})

describe('parseQty', () => {
  it('allows decimals, with a dot or a decimal comma', () => {
    expect(parseQty('2.5')).toBe(2.5)
    expect(parseQty('2,5')).toBe(2.5)
    expect(parseQty(' 12 ')).toBe(12)
  })

  it('maps junk, empty and negatives to 0', () => {
    expect(parseQty('')).toBe(0)
    expect(parseQty('abc')).toBe(0)
    expect(parseQty('-3')).toBe(0)
  })
})

describe('stock sums', () => {
  it('3 L stock less a 2.2 L sale is exactly 0.8 L', () => {
    const ledger = [movement(3), movement(-2.2)]
    expect(qtyOnHand(ledger, 'oil')).toBe(0.8)
    expect(qtyByProduct(ledger).get('oil')).toBe(0.8)
  })

  it('lets the last 0.8 L be sold', () => {
    const available = qtyOnHand([movement(3), movement(-2.2)], 'oil')
    expect(firstInsufficientStockProduct([{ productId: 'oil', delta: -0.8 }], () => available)).toBeNull()
  })

  it('reads fully drained stock as 0, not an oversold 1e-16', () => {
    const ledger = [movement(0.1), movement(0.2), movement(-0.3)]
    expect(qtyOnHand(ledger, 'oil')).toBe(0)
    expect(qtyByProduct(ledger).get('oil')).toBe(0)
  })

  it('rounds a lot balance the same way', () => {
    const lots: StockLot[] = [
      { id: 'lot-1', productId: 'oil', unitCost: 1000, receivedAt: '2026-09-01T00:00:00.000Z' } as StockLot,
    ]
    const ledger = [movement(3, { lotId: 'lot-1' }), movement(-2.2, { lotId: 'lot-1' })]
    expect(hydrateLots(lots, ledger)[0].qtyRemaining).toBe(0.8)
  })
})

describe('drawFifo with fractional quantities', () => {
  const lot = (qtyRemaining: number, id = 'lot-1', receivedAt = '2026-09-01T00:00:00.000Z'): LotBalance => ({
    id,
    productId: 'oil',
    unitCost: 1000,
    qtyRemaining,
    receivedAt,
  })

  it('has no phantom shortfall when a draw exactly empties the lots', () => {
    const draw = drawFifo([lot(0.1, 'a', '2026-09-01T00:00:00.000Z'), lot(0.2, 'b', '2026-09-02T00:00:00.000Z')], 0.3)
    expect(draw.shortfallQty).toBe(0)
    expect(draw.consumptions.map((c) => c.quantity)).toEqual([0.1, 0.2])
  })

  it('reports a real shortfall exactly', () => {
    const draw = drawFifo([lot(0.8)], 1)
    expect(draw.shortfallQty).toBe(0.2)
    expect(draw.cost).toBe(800)
  })
})
