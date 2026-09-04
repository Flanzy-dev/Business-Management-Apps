import { describe, it, expect } from 'vitest'
import { ALL_CATEGORIES, SERVICES_CATEGORY, filterVisibleServices, filterVisibleProducts, singleAddableMatch, onTicketCountFor } from '../checkoutCatalogFilter'
import type { ServiceCatalogItem } from '../../store/serviceCatalogStore'
import type { ProductWithStock } from '../stockLedger'
import type { WorkOrderItem } from '../../store/workOrderStore'

function service(overrides: Partial<ServiceCatalogItem> = {}): ServiceCatalogItem {
  return { id: 's-1', name: 'Ganti Oli', price: 50_000, serviceItemTypeId: null, notes: '', createdAt: '', ...overrides }
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
    createdAt: '',
    qtyOnHand: 10,
    ...overrides,
  }
}

describe('filterVisibleServices', () => {
  it('shows services under ALL_CATEGORIES and SERVICES_CATEGORY', () => {
    expect(filterVisibleServices([service()], ALL_CATEGORIES, '', new Map())).toHaveLength(1)
    expect(filterVisibleServices([service()], SERVICES_CATEGORY, '', new Map())).toHaveLength(1)
  })

  it('shows nothing once a specific product category is picked', () => {
    expect(filterVisibleServices([service()], 'Ban', '', new Map())).toEqual([])
  })

  it('filters by name', () => {
    const services = [service({ name: 'Ganti Oli' }), service({ id: 's-2', name: 'Spooring' })]
    expect(filterVisibleServices(services, ALL_CATEGORIES, 'oli', new Map()).map((s) => s.id)).toEqual(['s-1'])
  })
})

describe('filterVisibleProducts', () => {
  it('shows nothing at all under SERVICES_CATEGORY', () => {
    expect(filterVisibleProducts([product()], SERVICES_CATEGORY, '')).toEqual([])
  })

  it('filters by category name', () => {
    const products = [product({ category: 'Ban' }), product({ id: 'p-2', category: 'Oli Mesin Diesel' })]
    expect(filterVisibleProducts(products, 'Ban', '').map((p) => p.id)).toEqual(['p-1'])
  })

  it('matches by name/sku/supplierCode via matchesQuery', () => {
    const products = [product({ sku: 'OIL-1' })]
    expect(filterVisibleProducts(products, ALL_CATEGORIES, 'oil-1')).toHaveLength(1)
  })
})

describe('singleAddableMatch', () => {
  const items: WorkOrderItem[] = []

  it('is null with no results', () => {
    expect(singleAddableMatch([], [], items)).toBeNull()
  })

  it('is null with more than one result', () => {
    expect(singleAddableMatch([service()], [product()], items)).toBeNull()
  })

  it('matches a single service', () => {
    expect(singleAddableMatch([service()], [], items)).toEqual({ kind: 'service', service: service() })
  })

  it('matches a single addable product', () => {
    expect(singleAddableMatch([], [product()], items)).toEqual({ kind: 'product', product: product() })
  })

  it('excludes a sold-out product from the addable count', () => {
    const soldOut = product({ qtyOnHand: 0 })
    expect(singleAddableMatch([], [soldOut], items)).toBeNull()
  })
})

describe('onTicketCountFor', () => {
  it('is 0 when the product is not on the ticket', () => {
    expect(onTicketCountFor([], 'p-1')).toBe(0)
  })

  it('sums quantity across every line for that product', () => {
    const items = [
      { productId: 'p-1', quantity: 2 },
      { productId: 'p-2', quantity: 5 },
      { productId: 'p-1', quantity: 1 },
    ] as WorkOrderItem[]
    expect(onTicketCountFor(items, 'p-1')).toBe(3)
  })
})
