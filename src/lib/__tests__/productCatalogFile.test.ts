// Runs the real importer over the real shipped catalog — data/product-catalog.csv,
// the file a shop actually picks in Settings → Import Products. Every other test
// here feeds the parser a fixture it wrote itself, which proves the rules but not
// that this file still satisfies them. A stray edit, a re-export from Excel, or a
// regenerated supplier-code column would sail past those and only surface as a
// half-imported catalog in front of the user.
//
// Requires data/product-catalog.csv to be committed; it's read relative to the
// repo root, which is vitest's working directory.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Product } from '../../store/inventoryStore'
import { parseProductCsv, planProductImport, isEmptyPlan, type PlannedProduct } from '../productImport'

const csv = readFileSync(resolve(process.cwd(), 'data/product-catalog.csv'), 'utf8')
const { rows, errors } = parseProductCsv(csv)

/** A planned row as the product it would become, for the re-import check. */
function asProduct(row: PlannedProduct, i: number): Product {
  return {
    id: `p-${i}`,
    name: row.name,
    sku: row.sku,
    supplierCode: row.supplierCode,
    category: row.category,
    unit: row.unit,
    costPrice: row.costPrice,
    sellPrice: row.sellPrice,
    reorderPoint: row.reorderPoint,
    supplierId: row.supplierId,
    notes: row.notes,
    createdAt: '2026-08-10T00:00:00.000Z',
  }
}

describe('data/product-catalog.csv', () => {
  it('parses with no errors', () => {
    expect(errors).toEqual([])
    expect(rows).toHaveLength(501)
  })

  it('imports whole — every row becomes a product', () => {
    const plan = planProductImport(rows, [])
    expect(plan.errors).toEqual([])
    // Nothing lost to two rows claiming the same name.
    expect(plan.duplicatesInFile).toEqual([])
    expect(plan.create).toHaveLength(501)
  })

  it('carries 240 supplier codes, all in stored (uppercase, trimmed) form', () => {
    const codes = rows.map(r => r.supplierCode).filter(c => c !== '')
    expect(codes).toHaveLength(240)
    for (const code of codes) expect(code).toBe(code.trim().toUpperCase())
  })

  it('keeps codes that several products share', () => {
    // The "modal" code encodes cost, so the four Turalik 43/45 variants all
    // read "ES". If uniqueness is ever reinstated this fails here, rather than
    // silently blanking 56 products at import time.
    const turalik = rows.filter(r => /^Turalik (V )?4[35]$/.test(r.name))
    expect(turalik).toHaveLength(4)
    expect(turalik.map(r => r.supplierCode)).toEqual(['ES', 'ES', 'ES', 'ES'])
  })

  it('maps the awkward names the source sheets spell differently', () => {
    // The first two are ordinary "<name> <size>" joins; the last two are the
    // rows where the sheet already folded the size into the product name, so a
    // regression in that rule shows up here as a blank rather than in the file.
    const codeOf = (name: string) => rows.find(r => r.name === name)?.supplierCode
    expect(codeOf('Helix HX3 20/50 1 L')).toBe('LDW')
    expect(codeOf('Meditran S 40 1 L')).toBe('LPS')
    expect(codeOf('Castrol GTX 0/20 SP/CF ULTRA CLEAN 3.5 L')).toBe('TP')
    expect(codeOf('Enduro Matic S 10/30 0.6 L')).toBe('EDT')
  })

  it('is a no-op when imported a second time', () => {
    const first = planProductImport(rows, [])
    const second = planProductImport(rows, first.create.map(asProduct))
    expect(second.create).toEqual([])
    expect(second.unchanged).toBe(501)
    expect(isEmptyPlan(second)).toBe(true)
  })
})
