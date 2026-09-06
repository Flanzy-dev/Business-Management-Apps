import { describe, it, expect } from 'vitest'
import type { Product } from '../../store/inventoryStore'
import type { ProductCategory } from '../../store/productCategoryStore'
import type { ServiceItemType } from '../../store/serviceItemTypeStore'
import { resolveProductScheduleTag } from '../scheduleTagging'

function itemType(id: string, name: string): ServiceItemType {
  return { id, name, createdAt: '2026-07-25T00:00:00.000Z' }
}

function category(name: string, overrides: Partial<ProductCategory> = {}): ProductCategory {
  return { id: `cat-${name}`, name, createdAt: '2026-07-25T00:00:00.000Z', ...overrides }
}

function product(overrides: Partial<Product> = {}): Pick<Product, 'category' | 'serviceItemTypeId'> {
  return { category: 'Oli Mesin Bensin', serviceItemTypeId: undefined, ...overrides }
}

const itemTypes = [
  itemType('sit-oil', 'Oli Mesin'),
  itemType('sit-brake', 'Minyak Rem'),
  itemType('sit-trans', 'Oli Transmisi'),
  itemType('sit-gardan', 'Oli Gardan'),
  itemType('sit-oilfilter', 'Filter Oli'),
  itemType('sit-fuelfilter', 'Filter Solar'),
  itemType('sit-pss', 'Minyak Power Steering'),
]

describe('resolveProductScheduleTag', () => {
  it('resolves a built-in oil category to the Oli Mesin item type', () => {
    const categories = [category('Oli Mesin Bensin')]
    expect(resolveProductScheduleTag(product({ category: 'Oli Mesin Bensin' }), categories, itemTypes)).toBe('sit-oil')
  })

  it('resolves the built-in brake-fluid category', () => {
    const categories = [category('Pendingin & Minyak Rem')]
    expect(resolveProductScheduleTag(product({ category: 'Pendingin & Minyak Rem' }), categories, itemTypes)).toBe('sit-brake')
  })

  it('leaves the ambiguous transmission/gardan category unmapped rather than guessing', () => {
    const categories = [category('Oli Transmisi / Gardan')]
    expect(resolveProductScheduleTag(product({ category: 'Oli Transmisi / Gardan' }), categories, itemTypes)).toBeNull()
  })

  it('resolves a category with no schedule counterpart to null', () => {
    const categories = [category('Gemuk')]
    expect(resolveProductScheduleTag(product({ category: 'Gemuk' }), categories, itemTypes)).toBeNull()
  })

  it("a shop's own category name gets no built-in default", () => {
    const categories = [category('Ban & Velg')]
    expect(resolveProductScheduleTag(product({ category: 'Ban & Velg' }), categories, itemTypes)).toBeNull()
  })

  it("the category's own explicit mapping overrides the built-in default", () => {
    const categories = [category('Oli Mesin Bensin', { serviceItemTypeId: 'sit-trans' })]
    expect(resolveProductScheduleTag(product({ category: 'Oli Mesin Bensin' }), categories, itemTypes)).toBe('sit-trans')
  })

  it("the category's explicit null stops the fallback instead of reaching the built-in default", () => {
    const categories = [category('Oli Mesin Bensin', { serviceItemTypeId: null })]
    expect(resolveProductScheduleTag(product({ category: 'Oli Mesin Bensin' }), categories, itemTypes)).toBeNull()
  })

  it("a product's own override beats its category entirely", () => {
    const categories = [category('Oli Mesin Bensin')]
    expect(
      resolveProductScheduleTag(product({ category: 'Oli Mesin Bensin', serviceItemTypeId: 'sit-gardan' }), categories, itemTypes)
    ).toBe('sit-gardan')
  })

  it("a product's own explicit null stops the fallback even though its category resolves to something", () => {
    const categories = [category('Oli Mesin Bensin')]
    expect(
      resolveProductScheduleTag(product({ category: 'Oli Mesin Bensin', serviceItemTypeId: null }), categories, itemTypes)
    ).toBeNull()
  })

  it('resolves to null when the category row itself no longer exists', () => {
    expect(resolveProductScheduleTag(product({ category: 'Deleted Category' }), [], itemTypes)).toBeNull()
  })

  it('resolves each v3->v4 category that maps 1:1 onto a seeded item type', () => {
    expect(
      resolveProductScheduleTag(product({ category: 'Filter Oli' }), [category('Filter Oli')], itemTypes)
    ).toBe('sit-oilfilter')
    expect(
      resolveProductScheduleTag(product({ category: 'Filter Solar' }), [category('Filter Solar')], itemTypes)
    ).toBe('sit-fuelfilter')
    expect(
      resolveProductScheduleTag(product({ category: 'Minyak Power Steering' }), [category('Minyak Power Steering')], itemTypes)
    ).toBe('sit-pss')
  })

  it('leaves the other v3->v4 categories unmapped — no seeded counterpart', () => {
    expect(
      resolveProductScheduleTag(product({ category: 'Filter Udara' }), [category('Filter Udara')], itemTypes)
    ).toBeNull()
    expect(
      resolveProductScheduleTag(product({ category: 'Aki & Kelistrikan' }), [category('Aki & Kelistrikan')], itemTypes)
    ).toBeNull()
  })
})
