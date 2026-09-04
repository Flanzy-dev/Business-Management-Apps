import { describe, it, expect } from 'vitest'
import type { ProductWithStock } from '../stockLedger'
import { buildProductCsv, toCsv, productExportFilename, EXPORT_COLUMNS } from '../productExport'
import { parseCsv, parseProductCsv, planProductImport } from '../productImport'

let nextId = 1

function product(overrides: Partial<ProductWithStock> = {}): ProductWithStock {
  return {
    id: `p-${nextId++}`,
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
    qtyOnHand: 0,
    ...overrides,
  }
}

const derive = {
  supplierNameOf: (p: ProductWithStock) => (p.supplierId === 's-1' ? 'Toko Jaya' : ''),
  unitCostOf: (p: ProductWithStock) => p.costPrice,
}

/** Header + rows of the generated file, BOM already consumed by parseCsv. */
const tableOf = (products: ProductWithStock[]) => parseCsv(buildProductCsv(products, derive))

describe('toCsv', () => {
  it('quotes only the fields that need it', () => {
    expect(toCsv([['plain', 'has,comma', 'has"quote', 'has\nnewline']]))
      .toBe('plain,"has,comma","has""quote","has\nnewline"\n')
  })

  it('round-trips through parseCsv unchanged', () => {
    const rows = [['a', 'b'], ['Shell Gadus S2 V150C 3,2 Kg', 'say "hi"']]
    expect(parseCsv(toCsv(rows))).toEqual(rows)
  })
})

describe('buildProductCsv', () => {
  it('starts with a BOM so Excel reads the encoding right', () => {
    expect(buildProductCsv([product()], derive).startsWith('﻿')).toBe(true)
  })

  it('writes the header in the documented order', () => {
    expect(tableOf([product()])[0]).toEqual([...EXPORT_COLUMNS])
  })

  it('writes stored cost and sell price, not the derived blend', () => {
    // costPrice must stay the stored field, or re-importing this file would
    // overwrite the shop's entered cost with a FIFO average.
    const row = tableOf([product({ costPrice: 60_000, sellPrice: 80_000 })])[1]
    expect(row[5]).toBe('60000')
    expect(row[6]).toBe('80000')
  })

  it('values stock at the FIFO blended cost', () => {
    const blended = { ...derive, unitCostOf: () => 62_500 }
    const csv = parseCsv(buildProductCsv([product({ qtyOnHand: 4 })], blended))
    expect(csv[1][9]).toBe('4')          // qtyOnHand
    expect(csv[1][11]).toBe('250000')    // 4 × 62.500
  })

  it('carries an oversell through as a negative value rather than hiding it', () => {
    const row = tableOf([product({ qtyOnHand: -2, costPrice: 50_000 })])[1]
    expect(row[9]).toBe('-2')
    expect(row[11]).toBe('-100000')
  })

  it('writes the supplier name, blank when there is none', () => {
    const rows = tableOf([product({ supplierId: 's-1' }), product({ supplierId: null })])
    expect(rows[1][10]).toBe('Toko Jaya')
    expect(rows[2][10]).toBe('')
  })

  it('writes the supplier part number beside the SKU, blank when there is none', () => {
    const rows = tableOf([product({ sku: 'OIL-7', supplierCode: 'SHL-01' }), product()])
    expect(rows[1][2]).toBe('SHL-01')
    expect(rows[2][2]).toBe('')
  })

  it('handles an empty catalog as a header-only file', () => {
    expect(tableOf([])).toEqual([[...EXPORT_COLUMNS]])
  })
})

describe('export → import round trip', () => {
  const catalog = [
    // The awkward real rows: a comma inside the name, and a quote in notes.
    product({ name: 'Shell Gadus S2 V150C 3,2 Kg', category: 'Gemuk', sellPrice: 0, notes: 'BELUM ADA HARGA' }),
    product({ name: 'Meditran S 40 209 L', category: 'Oli Mesin Diesel', sellPrice: 12_500_000, reorderPoint: 2 }),
    product({ name: 'Enduro Sport 800 mL', category: 'Oli Mesin Motor / Matic', sellPrice: 65_000, notes: 'say "hi"', sku: 'OIL-7', supplierCode: 'SHL-01' }),
  ]

  it('reads back every importable field exactly', () => {
    const { rows, errors } = parseProductCsv(buildProductCsv(catalog, derive))
    expect(errors).toEqual([])
    expect(rows.map(r => ({
      name: r.name, sku: r.sku, supplierCode: r.supplierCode, category: r.category, unit: r.unit,
      costPrice: r.costPrice, sellPrice: r.sellPrice, reorderPoint: r.reorderPoint, notes: r.notes,
    }))).toEqual(catalog.map(p => ({
      name: p.name, sku: p.sku, supplierCode: p.supplierCode, category: p.category, unit: p.unit,
      costPrice: p.costPrice, sellPrice: p.sellPrice, reorderPoint: p.reorderPoint, notes: p.notes,
    })))
  })

  it('is a no-op when imported back over the same catalog', () => {
    const { rows } = parseProductCsv(buildProductCsv(catalog, derive))
    const plan = planProductImport(rows, catalog, ['Gemuk', 'Oli Mesin Diesel', 'Oli Mesin Motor / Matic'])
    expect(plan.create).toEqual([])
    expect(plan.updatePrice).toEqual([])
    expect(plan.unchanged).toBe(3)
    expect(plan.newCategories).toEqual([])
  })

  it('picks up exactly the prices that were edited', () => {
    const csv = buildProductCsv(catalog, derive).replace('65000', '70000')
    const { rows } = parseProductCsv(csv)
    const plan = planProductImport(rows, catalog)
    expect(plan.updatePrice).toEqual([
      { product: catalog[2], from: 65_000, to: 70_000 },
    ])
    expect(plan.unchanged).toBe(2)
  })
})

describe('supplier resolution on import', () => {
  const suppliers = [{ id: 's-1', name: 'Toko Jaya' }, { id: 's-2', name: 'PT Sumber Oli' }]
  const rowsFor = (supplier: string) =>
    parseProductCsv(`name,supplier\nEnduro Sport 800 mL,${supplier}`).rows

  it('links a product to the supplier the file names', () => {
    const plan = planProductImport(rowsFor('Toko Jaya'), [], [], suppliers)
    expect(plan.create[0].supplierId).toBe('s-1')
    expect(plan.errors).toEqual([])
  })

  it('matches ignoring case and surrounding space', () => {
    expect(planProductImport(rowsFor('  toko jaya  '), [], [], suppliers).create[0].supplierId).toBe('s-1')
  })

  it('leaves a blank supplier column unlinked and unremarked', () => {
    const plan = planProductImport(rowsFor(''), [], [], suppliers)
    expect(plan.create[0].supplierId).toBeNull()
    expect(plan.errors).toEqual([])
  })

  it('reports an unknown supplier instead of inventing one', () => {
    // A supplier carries contact details a price list doesn't have, so the
    // import never creates one — it says so and leaves the product unlinked.
    const plan = planProductImport(rowsFor('Toko Baru'), [], [], suppliers)
    expect(plan.create[0].supplierId).toBeNull()
    expect(plan.errors).toHaveLength(1)
    expect(plan.errors[0].message).toContain('Toko Baru')
  })

  it('still imports fine when the caller passes no suppliers at all', () => {
    expect(planProductImport(rowsFor(''), []).create[0].supplierId).toBeNull()
  })
})

describe('productExportFilename', () => {
  it('stamps the date', () => {
    expect(productExportFilename(new Date('2026-08-08T10:00:00Z'))).toBe('product-catalog-2026-08-08.csv')
  })
})
