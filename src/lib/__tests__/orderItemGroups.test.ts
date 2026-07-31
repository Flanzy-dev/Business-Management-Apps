import { describe, it, expect } from 'vitest'
import type { WorkOrderItem } from '../../store/workOrderStore'
import { groupOrderItemsByType } from '../orderItemGroups'

let nextId = 1

function item(overrides: Partial<WorkOrderItem> = {}): WorkOrderItem {
  return {
    id: `item-${nextId++}`,
    description: 'Line item',
    quantity: 1,
    unitPrice: 0,
    lineTotal: 0,
    productId: null,
    ...overrides,
  }
}

describe('groupOrderItemsByType', () => {
  it('splits items into products (productId set) and services (no productId)', () => {
    const groups = groupOrderItemsByType([
      item({ productId: 'oil-5w30' }),
      item({ productId: null }),
    ])
    expect(groups.products).toHaveLength(1)
    expect(groups.services).toHaveLength(1)
  })

  it('sums each group into its own subtotal, independent of the other group', () => {
    const groups = groupOrderItemsByType([
      item({ productId: 'oil-5w30', lineTotal: 100_000 }),
      item({ productId: 'filter-a', lineTotal: 50_000 }),
      item({ productId: null, lineTotal: 75_000 }),
    ])
    expect(groups.productsSubtotal).toBe(150_000)
    expect(groups.servicesSubtotal).toBe(75_000)
  })

  it('returns an empty products group when every line is a service', () => {
    const groups = groupOrderItemsByType([item({ productId: null }), item({ productId: null })])
    expect(groups.products).toEqual([])
    expect(groups.productsSubtotal).toBe(0)
    expect(groups.services).toHaveLength(2)
  })

  it('returns an empty services group when every line is a product', () => {
    const groups = groupOrderItemsByType([item({ productId: 'oil-5w30' })])
    expect(groups.services).toEqual([])
    expect(groups.servicesSubtotal).toBe(0)
  })

  it('handles an empty order with no items', () => {
    const groups = groupOrderItemsByType([])
    expect(groups).toEqual({ products: [], services: [], productsSubtotal: 0, servicesSubtotal: 0 })
  })

  it('classifies by productId alone, independent of serviceItemTypeId tagging', () => {
    // A product line tagged as a tracked service item is still a Product —
    // serviceItemTypeId only marks schedule-tracking, not product-vs-service.
    const groups = groupOrderItemsByType([
      item({ productId: 'oil-5w30', serviceItemTypeId: 'oli-mesin', serviceAction: 'changed' }),
    ])
    expect(groups.products).toHaveLength(1)
    expect(groups.services).toHaveLength(0)
  })
})
