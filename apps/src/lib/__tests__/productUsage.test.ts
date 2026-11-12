import { describe, expect, it } from 'vitest'
import { productUsageCounts, splitFrequentProducts } from '../orders/productUsage'
import type { WorkOrder, WorkOrderItem } from '../../store/workOrderStore'
import type { ProductWithStock } from '../inventory/stockLedger'

const line = (productId: string | null): WorkOrderItem =>
  ({ id: `l-${Math.random()}`, description: 'x', quantity: 1, unitPrice: 1, lineTotal: 1, productId }) as WorkOrderItem
const order = (status: WorkOrder['status'], ...ids: (string | null)[]): WorkOrder =>
  ({ id: `o-${Math.random()}`, status, items: ids.map(line) }) as WorkOrder
const product = (id: string): ProductWithStock => ({ id, name: id, qtyOnHand: 5 }) as ProductWithStock

describe('productUsageCounts', () => {
  it('counts product lines on completed orders only', () => {
    const counts = productUsageCounts([
      order('completed', 'p1', 'p1', 'p2'),
      order('completed', 'p1'),
      order('open', 'p2', 'p2'),
      order('cancelled', 'p2'),
    ])
    expect(counts.get('p1')).toBe(3)
    expect(counts.get('p2')).toBe(1)
  })

  it('ignores service lines', () => {
    expect(productUsageCounts([order('completed', null, null)]).size).toBe(0)
  })

  it('is empty with no orders', () => {
    expect(productUsageCounts([]).size).toBe(0)
  })
})

describe('splitFrequentProducts', () => {
  const products = ['a', 'b', 'c', 'd', 'e'].map(product)

  it('pins the best sellers, most sold first, and removes them from the rest', () => {
    const usage = new Map([['c', 9], ['a', 2], ['e', 2]])
    const { frequent, rest } = splitFrequentProducts(products, usage, 2)
    expect(frequent.map((p) => p.id)).toEqual(['c', 'a']) // tie a/e keeps catalog order
    expect(rest.map((p) => p.id)).toEqual(['b', 'd', 'e'])
  })

  it('pins nothing that has never sold', () => {
    const { frequent, rest } = splitFrequentProducts(products, new Map(), 8)
    expect(frequent).toEqual([])
    expect(rest).toHaveLength(5)
  })

  it('never pins more than the limit, and never repeats a product', () => {
    const usage = new Map(products.map((p, i) => [p.id, i + 1]))
    const { frequent, rest } = splitFrequentProducts(products, usage, 3)
    expect(frequent).toHaveLength(3)
    const all = [...frequent, ...rest].map((p) => p.id)
    expect(new Set(all).size).toBe(all.length)
    expect(all).toHaveLength(5)
  })

  it('works on an already-filtered list', () => {
    const { frequent, rest } = splitFrequentProducts([product('b'), product('d')], new Map([['d', 4], ['a', 99]]), 8)
    expect(frequent.map((p) => p.id)).toEqual(['d'])
    expect(rest.map((p) => p.id)).toEqual(['b'])
  })
})
