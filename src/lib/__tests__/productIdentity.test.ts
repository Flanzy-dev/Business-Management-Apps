import { describe, it, expect } from 'vitest'
import type { Product } from '../../store/inventoryStore'
import { findDuplicateProduct } from '../productIdentity'

let nextId = 1

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: `p-${nextId++}`,
    name: 'Shell HX7 5W-30',
    sku: 'OIL-SHELL-5W30',
    category: 'Oil',
    unit: 'liter',
    costPrice: 40_000,
    sellPrice: 95_000,
    reorderPoint: 2,
    supplierId: null,
    notes: '',
    createdAt: '2026-01-10T00:00:00.000Z',
    ...overrides,
  }
}

describe('findDuplicateProduct', () => {
  it('finds nothing in an empty or unrelated catalog', () => {
    expect(findDuplicateProduct([], { name: 'Shell HX7 5W-30', sku: 'OIL-1' })).toBeNull()
    expect(
      findDuplicateProduct([product({ name: 'Castrol', sku: 'OIL-2' })], { name: 'Shell', sku: 'OIL-1' })
    ).toBeNull()
  })

  it('matches a name ignoring case and surrounding whitespace', () => {
    const shell = product()
    const found = findDuplicateProduct([shell], { name: '  shell hx7 5w-30  ', sku: '' })
    expect(found).toEqual({ product: shell, field: 'name' })
  })

  it('matches a SKU the same way, under a different name', () => {
    const shell = product()
    const found = findDuplicateProduct([shell], { name: 'Castrol GTX', sku: ' oil-shell-5w30 ' })
    expect(found).toEqual({ product: shell, field: 'sku' })
  })

  it('never matches on a blank SKU — not even against another blank', () => {
    // Otherwise every product without a SKU would be a duplicate of the last
    // one entered, and most products here have none.
    const noSku = product({ name: 'Castrol', sku: '' })
    expect(findDuplicateProduct([noSku], { name: 'Shell HX7 5W-30', sku: '' })).toBeNull()
    expect(findDuplicateProduct([noSku], { name: 'Shell HX7 5W-30', sku: '   ' })).toBeNull()
  })

  it('reports the name when both fields clash — that is the one the user can act on', () => {
    const shell = product()
    const found = findDuplicateProduct([shell], { name: 'Shell HX7 5W-30', sku: 'OIL-SHELL-5W30' })
    expect(found?.field).toBe('name')
  })

  it('prefers a name clash on one product over a SKU clash on another', () => {
    const sameSku = product({ name: 'Castrol GTX', sku: 'OIL-SHELL-5W30' })
    const sameName = product({ name: 'Shell HX7 5W-30', sku: 'OIL-OTHER' })
    const found = findDuplicateProduct([sameSku, sameName], {
      name: 'Shell HX7 5W-30',
      sku: 'OIL-SHELL-5W30',
    })
    expect(found).toEqual({ product: sameName, field: 'name' })
  })

  it('lets a product being edited keep its own name and SKU', () => {
    const shell = product()
    expect(findDuplicateProduct([shell], { name: shell.name, sku: shell.sku }, shell.id)).toBeNull()
  })

  it('still catches an edit that renames onto another product', () => {
    const shell = product({ name: 'Shell HX7 5W-30' })
    const castrol = product({ name: 'Castrol GTX', sku: 'OIL-CASTROL' })
    const found = findDuplicateProduct([shell, castrol], { name: 'Castrol GTX', sku: 'OIL-X' }, shell.id)
    expect(found).toEqual({ product: castrol, field: 'name' })
  })

  it('ignores an empty name (the form blocks that separately)', () => {
    expect(findDuplicateProduct([product({ name: '' })], { name: '  ', sku: '' })).toBeNull()
  })
})
