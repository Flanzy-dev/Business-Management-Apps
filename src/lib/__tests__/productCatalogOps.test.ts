// The store-touching half of the price-list import. productImport.test.ts
// proves how a CSV becomes an ImportPlan; this proves what applying that plan
// does to the catalog — in particular the two properties the module's header
// promises but nothing verified: an import creates products at ZERO stock (no
// lots, no movements, so a catalog load can't invent inventory or inject a
// made-up cost into the FIFO chain), and price updates only happen when the
// caller opted in.
import { describe, it, expect } from 'vitest'
import { createProductCatalogOps } from '../ops/productCatalogOps'
import { buildFakeOpsDeps } from './helpers/fakeOpsDeps'
import type { ImportPlan, PlannedProduct } from '../productImport'
import type { Product } from '../../store/inventoryStore'

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p-1',
    name: 'Helix HX3 20/50 1 L',
    sku: '',
    supplierCode: '',
    category: 'Oli Mesin Bensin',
    unit: 'each',
    costPrice: 60_000,
    sellPrice: 80_000,
    reorderPoint: 0,
    supplierId: null,
    notes: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function plannedProduct(overrides: Partial<PlannedProduct> = {}): PlannedProduct {
  return {
    line: 2,
    name: 'Helix HX5 10W-40 4 L',
    sku: 'HX5-4L',
    supplierCode: 'ABC123',
    category: 'Oli Mesin Bensin',
    unit: 'each',
    costPrice: 200_000,
    sellPrice: 260_000,
    reorderPoint: 2,
    notes: '',
    supplier: 'Acme',
    supplierId: null,
    ...overrides,
  }
}

function plan(overrides: Partial<ImportPlan> = {}): ImportPlan {
  return {
    create: [],
    updatePrice: [],
    unchanged: 0,
    newCategories: [],
    duplicatesInFile: [],
    errors: [],
    ...overrides,
  }
}

describe('applyProductImport — creating products', () => {
  it('creates every planned product and reports the count', () => {
    const world = buildFakeOpsDeps()
    const outcome = createProductCatalogOps(world.deps).applyProductImport(
      plan({ create: [plannedProduct({ name: 'A' }), plannedProduct({ name: 'B' })] }),
      { updatePrices: false }
    )

    expect(outcome.created).toBe(2)
    expect(world.inventory.products.map((p) => p.name)).toEqual(['A', 'B'])
  })

  it('carries every planned field onto the created product', () => {
    const world = buildFakeOpsDeps()
    createProductCatalogOps(world.deps).applyProductImport(
      plan({ create: [plannedProduct({ supplierId: 's-1' })] }),
      { updatePrices: false }
    )

    expect(world.inventory.products[0]).toMatchObject({
      name: 'Helix HX5 10W-40 4 L',
      sku: 'HX5-4L',
      supplierCode: 'ABC123',
      category: 'Oli Mesin Bensin',
      costPrice: 200_000,
      sellPrice: 260_000,
      reorderPoint: 2,
      supplierId: 's-1',
    })
  })

  it('opens no lot, records no movement and books no expense — imports land at zero stock', () => {
    // The invariant the module header states: stock and its cost arrive later
    // through restockProduct, never from loading a supplier's sheet.
    const world = buildFakeOpsDeps()
    createProductCatalogOps(world.deps).applyProductImport(
      plan({ create: [plannedProduct(), plannedProduct({ name: 'Another' })] }),
      { updatePrices: true }
    )

    expect(world.stockLots.stockLots).toEqual([])
    expect(world.movements.movements).toEqual([])
    expect(world.expenses.expenses).toEqual([])
  })
})

describe('applyProductImport — price updates are opt-in', () => {
  it('rewrites sell prices when updatePrices is true', () => {
    const existing = product({ id: 'p-1', sellPrice: 80_000 })
    const world = buildFakeOpsDeps({ products: [existing] })
    const outcome = createProductCatalogOps(world.deps).applyProductImport(
      plan({ updatePrice: [{ product: existing, from: 80_000, to: 95_000 }] }),
      { updatePrices: true }
    )

    expect(outcome.pricesUpdated).toBe(1)
    expect(world.inventory.products[0].sellPrice).toBe(95_000)
  })

  it('leaves sell prices alone when updatePrices is false', () => {
    const existing = product({ id: 'p-1', sellPrice: 80_000 })
    const world = buildFakeOpsDeps({ products: [existing] })
    const outcome = createProductCatalogOps(world.deps).applyProductImport(
      plan({ updatePrice: [{ product: existing, from: 80_000, to: 95_000 }] }),
      { updatePrices: false }
    )

    expect(outcome.pricesUpdated).toBe(0)
    expect(world.inventory.products[0].sellPrice).toBe(80_000)
  })

  it('never touches cost price, only what the shop charges', () => {
    const existing = product({ id: 'p-1', costPrice: 60_000, sellPrice: 80_000 })
    const world = buildFakeOpsDeps({ products: [existing] })
    createProductCatalogOps(world.deps).applyProductImport(
      plan({ updatePrice: [{ product: existing, from: 80_000, to: 95_000 }] }),
      { updatePrices: true }
    )

    expect(world.inventory.products[0].costPrice).toBe(60_000)
  })
})

describe('applyProductImport — categories', () => {
  it('creates the categories the file names but the shop lacks', () => {
    const world = buildFakeOpsDeps({ categories: ['Oli Mesin Bensin'] })
    const outcome = createProductCatalogOps(world.deps).applyProductImport(
      plan({ newCategories: ['Oli Gardan', 'Filter'] }),
      { updatePrices: false }
    )

    expect(outcome.categoriesCreated).toBe(2)
    expect(world.productCategories.categories.map((c) => c.name)).toEqual([
      'Oli Mesin Bensin',
      'Oli Gardan',
      'Filter',
    ])
  })

  it('creates categories before the products filed under them', () => {
    // Otherwise an imported product sits in a category missing from Settings.
    const world = buildFakeOpsDeps()
    createProductCatalogOps(world.deps).applyProductImport(
      plan({
        newCategories: ['Oli Gardan'],
        create: [plannedProduct({ category: 'Oli Gardan' })],
      }),
      { updatePrices: false }
    )

    const categoryNames = world.productCategories.categories.map((c) => c.name)
    expect(categoryNames).toContain('Oli Gardan')
    expect(world.inventory.products[0].category).toBe('Oli Gardan')
  })
})

describe('applyProductImport — an empty plan', () => {
  it('changes nothing and reports all zeros', () => {
    const world = buildFakeOpsDeps({ products: [product()] })
    const outcome = createProductCatalogOps(world.deps).applyProductImport(plan(), {
      updatePrices: true,
    })

    expect(outcome).toEqual({ created: 0, pricesUpdated: 0, categoriesCreated: 0 })
    expect(world.inventory.products).toHaveLength(1)
  })
})
