import { describe, it, expect } from 'vitest'
import type { ProductWithStock } from '../stockLedger'
import {
  NO_FILTERS,
  activeFilterCount,
  filterProducts,
  sortProducts,
  nextSortState,
  DEFAULT_SORT,
  type ProductFilters,
} from '../productFilter'

let nextId = 1

function product(overrides: Partial<ProductWithStock> = {}): ProductWithStock {
  return {
    id: `p-${nextId++}`,
    name: 'Helix HX3 20/50 1 L',
    sku: '',
    supplierCode: '',
    category: 'Oli Mesin Bensin',
    unit: 'each',
    costPrice: 0,
    sellPrice: 80_000,
    reorderPoint: 0,
    supplierId: null,
    notes: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    qtyOnHand: 0,
    ...overrides,
  }
}

const filters = (overrides: Partial<ProductFilters> = {}): ProductFilters => ({ ...NO_FILTERS, ...overrides })

/** Sorting derivations: cost mirrors costPrice, supplier resolves by id. */
const derive = {
  costOf: (p: ProductWithStock) => p.costPrice,
  supplierNameOf: (p: ProductWithStock) => p.supplierId ?? '-',
}

describe('filterProducts', () => {
  const catalog = [
    product({ id: 'a', name: 'Meditran S 40 209 L', category: 'Oli Mesin Diesel', sellPrice: 12_500_000 }),
    product({ id: 'b', name: 'Helix HX3 20/50 1 L', category: 'Oli Mesin Bensin', sellPrice: 80_000, qtyOnHand: 6, reorderPoint: 5 }),
    product({ id: 'c', name: 'Meditran 30', category: 'Oli Mesin Diesel', sellPrice: 0 }),
    product({ id: 'd', name: 'Enduro Sport 800 mL', category: 'Oli Mesin Motor / Matic', sellPrice: 65_000, qtyOnHand: 2, reorderPoint: 5, supplierId: 's-1' }),
    product({ id: 'e', name: 'Turalik 45', category: 'Oli Industri / Hidrolik', sellPrice: 55_000, qtyOnHand: -3, reorderPoint: 1 }),
  ]
  const ids = (f: ProductFilters) => filterProducts(catalog, f).map(p => p.id)

  it('returns everything when nothing is set', () => {
    expect(ids(filters())).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  it('searches name, SKU and supplier code, ignoring case', () => {
    expect(ids(filters({ search: 'meditran' }))).toEqual(['a', 'c'])
    expect(ids(filters({ search: '  HELIX  ' }))).toEqual(['b'])
    const withSku = [product({ id: 'x', name: 'Nothing', sku: 'OIL-99' })]
    expect(filterProducts(withSku, filters({ search: 'oil-99' })).map(p => p.id)).toEqual(['x'])
    // A part number off the box finds the product even when nothing else matches.
    const withCode = [product({ id: 'y', name: 'Nothing', sku: '', supplierCode: '550041101' })]
    expect(filterProducts(withCode, filters({ search: '55004' })).map(p => p.id)).toEqual(['y'])
  })

  it('takes several categories at once', () => {
    expect(ids(filters({ categories: ['Oli Mesin Diesel'] }))).toEqual(['a', 'c'])
    expect(ids(filters({ categories: ['Oli Mesin Diesel', 'Oli Mesin Bensin'] }))).toEqual(['a', 'b', 'c'])
    // Empty means "all", not "none" — an unticked list must not blank the table.
    expect(ids(filters({ categories: [] }))).toHaveLength(5)
  })

  it('filters by supplier, and by having none', () => {
    expect(ids(filters({ supplierId: 's-1' }))).toEqual(['d'])
    expect(ids(filters({ supplierId: '' }))).toEqual(['a', 'b', 'c', 'e'])
    expect(ids(filters({ supplierId: null }))).toHaveLength(5)
  })

  it('splits the stock buckets the way the row badges do', () => {
    expect(ids(filters({ stockStatus: 'in' }))).toEqual(['b', 'd'])
    expect(ids(filters({ stockStatus: 'out' }))).toEqual(['a', 'c'])
    expect(ids(filters({ stockStatus: 'oversold' }))).toEqual(['e'])
    // 'd' is 2 of a reorder point of 5; 'e' is oversold and also under its
    // point; 'b' has 6 of 5 and 'a'/'c' have no reorder point at all.
    expect(ids(filters({ stockStatus: 'low' }))).toEqual(['d', 'e'])
  })

  it('treats price bounds as inclusive', () => {
    expect(ids(filters({ minPrice: 65_000 }))).toEqual(['a', 'b', 'd'])
    expect(ids(filters({ maxPrice: 65_000 }))).toEqual(['c', 'd', 'e'])
    expect(ids(filters({ minPrice: 55_000, maxPrice: 80_000 }))).toEqual(['b', 'd', 'e'])
  })

  it('separates "not priced yet" from a minimum of zero', () => {
    expect(ids(filters({ missingPriceOnly: true }))).toEqual(['c'])
    expect(ids(filters({ minPrice: 0 }))).toHaveLength(5)
  })

  it('applies every filter together', () => {
    expect(ids(filters({ search: 'meditran', categories: ['Oli Mesin Diesel'], maxPrice: 100_000 }))).toEqual(['c'])
  })
})

describe('activeFilterCount', () => {
  it('counts nothing for untouched filters', () => {
    expect(activeFilterCount(NO_FILTERS)).toBe(0)
  })

  it('ignores search, which has its own visible box', () => {
    expect(activeFilterCount(filters({ search: 'helix' }))).toBe(0)
  })

  it('counts a price range once however many bounds are set', () => {
    expect(activeFilterCount(filters({ minPrice: 1 }))).toBe(1)
    expect(activeFilterCount(filters({ minPrice: 1, maxPrice: 2 }))).toBe(1)
  })

  it('counts each distinct filter', () => {
    const f = filters({ categories: ['Gemuk'], supplierId: '', stockStatus: 'low', maxPrice: 5, missingPriceOnly: true })
    expect(activeFilterCount(f)).toBe(5)
  })
})

describe('nextSortState', () => {
  it('opens a price/cost/stock column at its highest value first', () => {
    // "Sort by price" means "what are my most expensive products".
    expect(nextSortState(DEFAULT_SORT, 'price')).toEqual({ key: 'price', direction: 'desc' })
    expect(nextSortState(DEFAULT_SORT, 'cost')).toEqual({ key: 'cost', direction: 'desc' })
    expect(nextSortState(DEFAULT_SORT, 'stock')).toEqual({ key: 'stock', direction: 'desc' })
  })

  it('opens a text column A–Z', () => {
    expect(nextSortState({ key: 'price', direction: 'desc' }, 'category'))
      .toEqual({ key: 'category', direction: 'asc' })
  })

  it('flips the column that is already sorting', () => {
    expect(nextSortState({ key: 'price', direction: 'desc' }, 'price')).toEqual({ key: 'price', direction: 'asc' })
    expect(nextSortState({ key: 'price', direction: 'asc' }, 'price')).toEqual({ key: 'price', direction: 'desc' })
  })
})

describe('sortProducts', () => {
  const catalog = [
    product({ id: 'cheap', name: 'Turalik 45', sellPrice: 55_000, costPrice: 40_000, qtyOnHand: 9 }),
    product({ id: 'dear', name: 'Meditran S 40 209 L', sellPrice: 12_500_000, costPrice: 9_000_000, qtyOnHand: 1 }),
    product({ id: 'free', name: 'Meditran 30', sellPrice: 0, costPrice: 0, qtyOnHand: -2 }),
  ]
  const order = (key: Parameters<typeof nextSortState>[1], direction: 'asc' | 'desc') =>
    sortProducts(catalog, { key, direction }, derive).map(p => p.id)

  it('puts the most expensive first when price runs descending', () => {
    expect(order('price', 'desc')).toEqual(['dear', 'cheap', 'free'])
    expect(order('price', 'asc')).toEqual(['free', 'cheap', 'dear'])
  })

  it('sorts by derived cost and by stock', () => {
    expect(order('cost', 'desc')).toEqual(['dear', 'cheap', 'free'])
    expect(order('stock', 'asc')).toEqual(['free', 'dear', 'cheap'])
  })

  it('sorts by supplier code, with the products that have none grouped together', () => {
    const coded = [
      product({ id: 'b', name: 'B', supplierCode: 'SHL-02' }),
      product({ id: 'none', name: 'A', supplierCode: '' }),
      product({ id: 'a', name: 'C', supplierCode: 'SHL-01' }),
    ]
    const by = (direction: 'asc' | 'desc') =>
      sortProducts(coded, { key: 'supplierCode', direction }, derive).map(p => p.id)
    expect(by('asc')).toEqual(['none', 'a', 'b'])
    expect(by('desc')).toEqual(['b', 'a', 'none'])
  })

  it('sorts text naturally, so 4 L comes before 10 L', () => {
    const sizes = [
      product({ id: '10', name: 'Meditran S 40 10 L' }),
      product({ id: '4', name: 'Meditran S 40 4 L' }),
      product({ id: '209', name: 'Meditran S 40 209 L' }),
    ]
    expect(sortProducts(sizes, { key: 'name', direction: 'asc' }, derive).map(p => p.id))
      .toEqual(['4', '10', '209'])
  })

  it('breaks ties by name, ascending, whichever way the column runs', () => {
    // The imported catalog has 282 products all sitting at price 0 — without a
    // tiebreak their order would not be reproducible between renders.
    const tied = [
      product({ id: 'c', name: 'Charlie', sellPrice: 0 }),
      product({ id: 'a', name: 'Alpha', sellPrice: 0 }),
      product({ id: 'b', name: 'Bravo', sellPrice: 0 }),
    ]
    expect(sortProducts(tied, { key: 'price', direction: 'desc' }, derive).map(p => p.id)).toEqual(['a', 'b', 'c'])
    expect(sortProducts(tied, { key: 'price', direction: 'asc' }, derive).map(p => p.id)).toEqual(['a', 'b', 'c'])
  })

  it('never reorders the array it was given', () => {
    const original = [...catalog]
    sortProducts(catalog, { key: 'price', direction: 'desc' }, derive)
    expect(catalog).toEqual(original)
  })
})
