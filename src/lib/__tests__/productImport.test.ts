import { describe, it, expect } from 'vitest'
import type { Product } from '../../store/inventoryStore'
import { parseCsv, parseIdrAmount, parseProductCsv, planProductImport, isEmptyPlan } from '../productImport'

let nextId = 1

function product(overrides: Partial<Product> = {}): Product {
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
    ...overrides,
  }
}

const HEADER = 'name,category,unit,sellPrice,notes\n'

describe('parseCsv', () => {
  it('keeps commas that live inside a quoted field', () => {
    // Real rows from data/product-catalog.csv — the pack size carries a comma.
    const rows = parseCsv('a,b\n"Shell Gadus S2 V150C 3,2 Kg",Gemuk')
    expect(rows[1]).toEqual(['Shell Gadus S2 V150C 3,2 Kg', 'Gemuk'])
  })

  it('unescapes doubled quotes', () => {
    expect(parseCsv('x\n"say ""hi"""')[1]).toEqual(['say "hi"'])
  })

  it('handles CRLF, a trailing newline and blank lines', () => {
    const rows = parseCsv('a,b\r\n1,2\r\n\r\n3,4\r\n')
    expect(rows).toEqual([['a', 'b'], ['1', '2'], ['3', '4']])
  })

  it('strips a UTF-8 BOM so the first header still matches', () => {
    expect(parseCsv('﻿name,sellPrice')[0][0]).toBe('name')
  })
})

describe('parseIdrAmount', () => {
  it('reads Indonesian thousand separators as whole Rupiah', () => {
    expect(parseIdrAmount('6.500.000')).toBe(6_500_000)
    expect(parseIdrAmount('72.500')).toBe(72_500)
    expect(parseIdrAmount('6,500,000')).toBe(6_500_000)
    expect(parseIdrAmount('6500000')).toBe(6_500_000)
  })

  it('treats blank and junk as no price rather than throwing', () => {
    expect(parseIdrAmount('')).toBe(0)
    expect(parseIdrAmount('   ')).toBe(0)
    expect(parseIdrAmount('-')).toBe(0)
  })

  it('ignores currency decoration', () => {
    expect(parseIdrAmount('Rp 125.000,-')).toBe(125_000)
  })
})

describe('parseProductCsv', () => {
  it('maps columns by header name, whatever their order or spelling', () => {
    const { rows } = parseProductCsv('Sell Price,Name,Reorder_Point\n80.000,Helix HX3 20/50 1 L,3')
    expect(rows[0]).toMatchObject({ name: 'Helix HX3 20/50 1 L', sellPrice: 80_000, reorderPoint: 3 })
  })

  it('accepts a two-column price-only sheet', () => {
    const { rows, errors } = parseProductCsv('name,sellPrice\nHelix HX3 20/50 1 L,85.000')
    expect(errors).toEqual([])
    expect(rows[0]).toMatchObject({ name: 'Helix HX3 20/50 1 L', sellPrice: 85_000, unit: 'each', category: '' })
  })

  it('ignores columns it does not know', () => {
    const { rows } = parseProductCsv('name,modal code,sellPrice\nHelix HX3 20/50 1 L,LDW,80.000')
    expect(rows[0]).toMatchObject({ name: 'Helix HX3 20/50 1 L', sellPrice: 80_000 })
  })

  it('reads a supplier code column however it is spelled, and stores it uppercase', () => {
    const spellings = ['Supplier Code', 'supplier_code', 'supplierCode', 'SUPPLIERCODE']
    for (const header of spellings) {
      const { rows } = parseProductCsv(`name,${header}\nHelix HX3 20/50 1 L, 550041101 `)
      expect(rows[0].supplierCode).toBe('550041101')
    }
    const { rows } = parseProductCsv('name,supplier code\nHelix HX3 20/50 1 L,shl-01')
    expect(rows[0].supplierCode).toBe('SHL-01')
  })

  it('does not confuse the supplier code column with the supplier name column', () => {
    const { rows } = parseProductCsv('name,supplier,supplierCode\nHelix HX3 20/50 1 L,Shell Indonesia,SHL-01')
    expect(rows[0]).toMatchObject({ supplier: 'Shell Indonesia', supplierCode: 'SHL-01' })
  })

  it('refuses a file with no name column', () => {
    const { rows, errors } = parseProductCsv('product,price\nHelix,80.000')
    expect(rows).toEqual([])
    expect(errors[0].message).toContain('name')
  })

  it('skips a nameless row and reports its line number', () => {
    const { rows, errors } = parseProductCsv(`${HEADER},Gemuk,each,1000,\nEnduro Sport 800 mL,Oli Mesin Motor / Matic,each,65.000,`)
    expect(rows).toHaveLength(1)
    expect(errors).toEqual([{ line: 2, message: 'Row has no product name' }])
  })

  it('leaves an unpriced row at zero rather than dropping it', () => {
    const { rows } = parseProductCsv(`${HEADER}Meditran 30,Oli Mesin Diesel,each,,BELUM ADA HARGA`)
    expect(rows[0]).toMatchObject({ name: 'Meditran 30', sellPrice: 0, notes: 'BELUM ADA HARGA' })
  })
})

describe('planProductImport', () => {
  const rowsOf = (csv: string) => parseProductCsv(HEADER + csv).rows

  it('creates everything against an empty catalog', () => {
    const rows = rowsOf('Helix HX3 20/50 1 L,Oli Mesin Bensin,each,80.000,\nMeditran 30,Oli Mesin Diesel,each,,BELUM ADA HARGA')
    const plan = planProductImport(rows, [])
    expect(plan.create).toHaveLength(2)
    expect(plan.unchanged).toBe(0)
    expect(plan.updatePrice).toEqual([])
  })

  it('is a no-op when re-run against what it created', () => {
    const rows = rowsOf('Helix HX3 20/50 1 L,Oli Mesin Bensin,each,80.000,')
    const plan = planProductImport(rows, [product({ name: 'Helix HX3 20/50 1 L', sellPrice: 80_000 })])
    expect(plan.create).toEqual([])
    expect(plan.unchanged).toBe(1)
    expect(isEmptyPlan(plan)).toBe(true)
  })

  it('matches an existing product the way the Add Product form does', () => {
    // Same normalization as findDuplicateProduct — case and surrounding space.
    const rows = rowsOf('  helix hx3 20/50 1 l  ,Oli Mesin Bensin,each,95.000,')
    const existing = product({ name: 'Helix HX3 20/50 1 L', sellPrice: 80_000 })
    const plan = planProductImport(rows, [existing])
    expect(plan.create).toEqual([])
    expect(plan.updatePrice).toEqual([{ product: existing, from: 80_000, to: 95_000 }])
  })

  it('never wipes a real price with a blank one', () => {
    const rows = rowsOf('Helix HX3 20/50 1 L,Oli Mesin Bensin,each,,BELUM ADA HARGA')
    const plan = planProductImport(rows, [product({ name: 'Helix HX3 20/50 1 L', sellPrice: 80_000 })])
    expect(plan.updatePrice).toEqual([])
    expect(plan.unchanged).toBe(1)
  })

  it('keeps the first of two rows claiming the same name', () => {
    const rows = rowsOf('Enduro 4T 20/50 1 L,Oli Mesin Motor / Matic,each,70.000,\nEnduro 4T 20/50 1 L,Oli Mesin Motor / Matic,each,,')
    const plan = planProductImport(rows, [])
    expect(plan.create).toHaveLength(1)
    expect(plan.create[0].sellPrice).toBe(70_000)
    expect(plan.duplicatesInFile).toHaveLength(1)
  })

  it('lists categories the shop does not have yet, once each', () => {
    const rows = rowsOf(
      'Turalik 45,Oli Industri / Hidrolik,each,55.000,\n' +
      'Termo 32,Oli Industri / Hidrolik,each,,\n' +
      'Helix HX3 20/50 1 L,Oli Mesin Bensin,each,80.000,'
    )
    const plan = planProductImport(rows, [], ['Oli Mesin Bensin', 'Gemuk'])
    expect(plan.newCategories).toEqual(['Oli Industri / Hidrolik'])
  })

  it('does not count a category as new just because an existing product uses it', () => {
    const rows = rowsOf('Helix HX5 15/40 1 L,Oli Mesin Bensin,each,100.000,')
    const plan = planProductImport(rows, [], ['oli mesin bensin'])
    expect(plan.newCategories).toEqual([])
  })

  it('carries a supplier code through to the created product', () => {
    const { rows } = parseProductCsv('name,supplierCode\nHelix HX3 20/50 1 L,shl-01')
    const plan = planProductImport(rows, [])
    expect(plan.create[0].supplierCode).toBe('SHL-01')
    expect(plan.errors).toEqual([])
  })

  it('lets products share a supplier code, in the file and against the catalog', () => {
    // The "modal" code encodes cost, so everything bought at the same price
    // carries it — the four Turalik 43/45 variants are all "ES". Rejecting or
    // blanking repeats would gut data/product-catalog.csv on import.
    const { rows } = parseProductCsv(
      'name,supplierCode\nTuralik 43,ES\nTuralik V 43,ES\nTuralik 45,es'
    )
    const plan = planProductImport(rows, [product({ name: 'Turalik V 45', supplierCode: 'ES' })])
    expect(plan.create.map((r) => r.supplierCode)).toEqual(['ES', 'ES', 'ES'])
    expect(plan.errors).toEqual([])
  })

  it('leaves blank codes alone however many rows have none', () => {
    const { rows } = parseProductCsv(
      'name,supplierCode\nHelix HX3 20/50 1 L,\nEnduro 4T 20/50 1 L,   '
    )
    const plan = planProductImport(rows, [product({ name: 'Meditran 30', supplierCode: '' })])
    expect(plan.create.map((r) => r.supplierCode)).toEqual(['', ''])
    expect(plan.errors).toEqual([])
  })
})
