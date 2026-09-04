// WorkOrderEditor's tap-to-add merge rules, now that they live outside the
// component (see ../workOrderLines.ts's header for why). The cases worth
// having are the ones the two hand-written copies could drift on: matching
// must key on the resolved schedule tag too, not just product/description,
// and a service tap must never merge into a product line of the same name.
import { describe, it, expect } from 'vitest'
import { findMatchingProductLine, buildProductLine, findMatchingServiceLine } from '../workOrderLines'
import type { WorkOrderItem } from '../../store/workOrderStore'
import type { ProductWithStock } from '../stockLedger'

function item(overrides: Partial<WorkOrderItem> = {}): WorkOrderItem {
  return { id: 'item-1', description: 'Oil filter', quantity: 1, unitPrice: 50_000, lineTotal: 50_000, ...overrides }
}

function product(overrides: Partial<ProductWithStock> = {}): ProductWithStock {
  return {
    id: 'p-1',
    name: 'Mobil 1 5W-30',
    sku: '',
    supplierCode: '',
    category: 'Oli Mesin Diesel',
    unit: 'each',
    costPrice: 50_000,
    sellPrice: 80_000,
    reorderPoint: 5,
    supplierId: null,
    notes: '',
    serviceItemTypeId: undefined,
    createdAt: '2026-01-01T00:00:00.000Z',
    qtyOnHand: 10,
    ...overrides,
  }
}

describe('findMatchingProductLine', () => {
  it('matches the same product with the same schedule tag', () => {
    const items = [item({ id: 'a', productId: 'p-1', serviceItemTypeId: 'oil' })]
    expect(findMatchingProductLine(items, 'p-1', 'oil')?.id).toBe('a')
  })

  it('does not match the same product with a different (or no) schedule tag', () => {
    const items = [item({ id: 'a', productId: 'p-1', serviceItemTypeId: 'oil' })]
    expect(findMatchingProductLine(items, 'p-1', null)).toBeUndefined()
  })

  it('treats undefined and null schedule tags as the same "no tag" value', () => {
    const items = [item({ id: 'a', productId: 'p-1', serviceItemTypeId: undefined })]
    expect(findMatchingProductLine(items, 'p-1', null)?.id).toBe('a')
  })

  it('does not match a different product', () => {
    const items = [item({ id: 'a', productId: 'p-2', serviceItemTypeId: null })]
    expect(findMatchingProductLine(items, 'p-1', null)).toBeUndefined()
  })
})

describe('buildProductLine', () => {
  it('builds an untagged line with no schedule fields when serviceItemTypeId is null', () => {
    const line = buildProductLine(product(), null)
    expect(line).toEqual({ description: 'Mobil 1 5W-30', quantity: 1, unitPrice: 80_000, productId: 'p-1' })
  })

  it('tags the line as a changed service when a schedule tag resolves', () => {
    const line = buildProductLine(product(), 'oil')
    expect(line.serviceItemTypeId).toBe('oil')
    expect(line.serviceAction).toBe('changed')
    expect(line.quantityLiters).toBeNull()
    expect(line.containerType).toBeNull()
  })
})

describe('findMatchingServiceLine', () => {
  it('matches by description and schedule tag', () => {
    const items = [item({ id: 'a', description: 'Ganti Oli', serviceItemTypeId: 'oil' })]
    expect(findMatchingServiceLine(items, { description: 'Ganti Oli', serviceItemTypeId: 'oil' })?.id).toBe('a')
  })

  it('never matches a product-linked line, even with the same description and tag', () => {
    const items = [item({ id: 'a', description: 'Ganti Oli', serviceItemTypeId: 'oil', productId: 'p-1' })]
    expect(findMatchingServiceLine(items, { description: 'Ganti Oli', serviceItemTypeId: 'oil' })).toBeUndefined()
  })

  it('does not match a line with a different schedule tag', () => {
    const items = [item({ id: 'a', description: 'Ganti Oli', serviceItemTypeId: 'brake' })]
    expect(findMatchingServiceLine(items, { description: 'Ganti Oli', serviceItemTypeId: 'oil' })).toBeUndefined()
  })
})
