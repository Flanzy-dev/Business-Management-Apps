import { describe, it, expect, beforeEach } from 'vitest'
import { ALL_CATEGORIES, SERVICES_CATEGORY, filterVisibleServices, filterVisibleProducts, singleAddableMatch, onTicketCountFor } from '../orders/checkoutCatalogFilter'
import { useLanguageStore } from '../../store/languageStore'
import type { ServiceCatalogItem } from '../../store/serviceCatalogStore'
import type { ProductWithStock } from '../inventory/stockLedger'
import type { WorkOrderItem } from '../../store/workOrderStore'

beforeEach(() => {
  useLanguageStore.getState().setLanguage('en')
})

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

  it('also matches the current-language translated label of a built-in service', () => {
    const services = [service({ id: 's-1', name: 'Ganti Oli Mesin' }), service({ id: 's-2', name: 'Spooring' })]
    // Stored name is Indonesian; typing the EN label ("Engine Oil Change")
    // must still find it.
    expect(filterVisibleServices(services, ALL_CATEGORIES, 'engine oil', new Map()).map((s) => s.id)).toEqual(['s-1'])
    // The raw stored name still matches too, regardless of active language.
    expect(filterVisibleServices(services, ALL_CATEGORIES, 'ganti oli mesin', new Map()).map((s) => s.id)).toEqual(['s-1'])
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

describe('searching by name and oil grade', () => {
  const grades = [
    product({ id: 'g1', name: 'Castrol GTX 10/40 1 L' }),
    product({ id: 'g2', name: 'Castrol GTX 10/40 4 L' }),
    product({ id: 'g3', name: 'Castrol GTX 15/40 SP/CF 1 L' }),
    product({ id: 'g4', name: 'Castrol Magnatec 10/40 1 L' }),
  ]
  const ids = (q: string) => filterVisibleProducts(grades, ALL_CATEGORIES, q).map((p) => p.id)

  it('finds a product by name plus grade', () => {
    expect(ids('castrol 10/40')).toEqual(['g1', 'g2', 'g4'])
  })

  it('finds it whichever way the grade and size are written', () => {
    expect(ids('gtx 10w40')).toEqual(['g1', 'g2'])
    expect(ids('gtx 10-40 4l')).toEqual(['g2'])
    expect(ids('magnatec 10w-40 1 liter')).toEqual(['g4'])
  })

  it('does not return another grade', () => {
    expect(ids('castrol 10/30')).toEqual([])
  })

  it('lists a misspelled brand after the exact hits and still finds it', () => {
    const mixed = [product({ id: 'x', name: 'Kastrol Lokal 10/40' }), ...grades]
    expect(filterVisibleProducts(mixed, ALL_CATEGORIES, 'castrol 10/40').map((p) => p.id)).toEqual(['g1', 'g2', 'g4', 'x'])
  })
})

describe('singleAddableMatch with a typed query', () => {
  const only = [product({ name: 'Castrol GTX 10/40 1 L' })]

  it('adds a single exact hit on Enter', () => {
    expect(singleAddableMatch([], only, [], 'castrol 10/40')?.kind).toBe('product')
  })

  it('does not add a lone near-miss spelling — a typo must not pick the product', () => {
    expect(singleAddableMatch([], only, [], 'kastrol 10/40')).toBeNull()
  })

  it('does not add a lone near-miss service either', () => {
    expect(singleAddableMatch([service({ name: 'Ganti Oli Mesin' })], [], [], 'gantu oli')).toBeNull()
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
