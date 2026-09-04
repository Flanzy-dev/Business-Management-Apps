// The Add/Edit Product dialog's rules, now that they live outside the
// component (see ../productForm.ts's header for why). The cases worth having
// are the ones a hand-written-twice mapping or interleaved decision/toast
// logic hides: the schedule-item sentinel round trip, and which duplicate
// case offers a restock versus blocks the save.
import { describe, it, expect } from 'vitest'
import {
  INHERIT_SCHEDULE_ITEM,
  NO_SCHEDULE_ITEM,
  scheduleItemToDraft,
  scheduleItemFromDraft,
  initialProductDraft,
  validateProductDraft,
  productDraftToData,
  duplicateResolution,
  duplicateResolutionToast,
  initialPurchase,
  type ProductDraft,
} from '../productForm'
import type { ProductWithStock } from '../stockLedger'
import type { ProductDuplicate } from '../productIdentity'

function product(overrides: Partial<ProductWithStock> = {}): ProductWithStock {
  return {
    id: 'p-1',
    name: 'Mobil 1 5W-30',
    sku: 'OIL-MOB1',
    supplierCode: 'MOB1',
    category: 'Oli Mesin Diesel',
    unit: 'each',
    costPrice: 50_000,
    sellPrice: 80_000,
    reorderPoint: 5,
    supplierId: 'sup-1',
    notes: '',
    serviceItemTypeId: undefined,
    createdAt: '2026-01-01T00:00:00.000Z',
    qtyOnHand: 10,
    ...overrides,
  }
}

describe('scheduleItemToDraft / scheduleItemFromDraft', () => {
  it('round-trips undefined (inherit) through the sentinel', () => {
    const draft = scheduleItemToDraft(undefined)
    expect(draft).toBe(INHERIT_SCHEDULE_ITEM)
    expect(scheduleItemFromDraft(draft)).toBeUndefined()
  })

  it('round-trips null (deliberately none) through the sentinel', () => {
    const draft = scheduleItemToDraft(null)
    expect(draft).toBe(NO_SCHEDULE_ITEM)
    expect(scheduleItemFromDraft(draft)).toBeNull()
  })

  it('round-trips a real ServiceItemType id unchanged', () => {
    const draft = scheduleItemToDraft('oil-change')
    expect(draft).toBe('oil-change')
    expect(scheduleItemFromDraft(draft)).toBe('oil-change')
  })
})

describe('initialProductDraft', () => {
  it('is blank with this dialog\'s defaults for a new product', () => {
    const draft = initialProductDraft(null)
    expect(draft.name).toBe('')
    expect(draft.category).toBe('Oli Mesin Diesel')
    expect(draft.unit).toBe('each')
    expect(draft.qtyOnHand).toBe('0')
    expect(draft.reorderPoint).toBe('5')
    expect(draft.recordInitialExpense).toBe(true)
    expect(draft.scheduleItemOverride).toBe(INHERIT_SCHEDULE_ITEM)
  })

  it('mirrors an existing product\'s values when editing', () => {
    const draft = initialProductDraft(product({ serviceItemTypeId: null }))
    expect(draft.name).toBe('Mobil 1 5W-30')
    expect(draft.costPrice).toBe('50000')
    expect(draft.qtyOnHand).toBe('10')
    expect(draft.scheduleItemOverride).toBe(NO_SCHEDULE_ITEM)
  })
})

describe('validateProductDraft', () => {
  function draft(overrides: Partial<ProductDraft> = {}): ProductDraft {
    return { ...initialProductDraft(null), name: 'A product', sellPrice: '1000', ...overrides }
  }

  it('passes a filled-in draft', () => {
    expect(validateProductDraft(draft())).toEqual({ ok: true })
  })

  it('flags a blank name', () => {
    const v = validateProductDraft(draft({ name: '  ' }))
    expect(v).toEqual({ ok: false, nameRequired: true, sellPriceRequired: false })
  })

  it('flags a blank sell price', () => {
    const v = validateProductDraft(draft({ sellPrice: '' }))
    expect(v).toEqual({ ok: false, nameRequired: false, sellPriceRequired: true })
  })

  it('flags both at once', () => {
    const v = validateProductDraft(draft({ name: '', sellPrice: '' }))
    expect(v).toEqual({ ok: false, nameRequired: true, sellPriceRequired: true })
  })
})

describe('productDraftToData', () => {
  it('parses numeric fields and normalizes the supplier code', () => {
    const draft: ProductDraft = {
      ...initialProductDraft(null),
      name: 'New Product',
      supplierCode: '  ldw  ',
      costPrice: '12.5',
      sellPrice: '20000',
      reorderPoint: '3',
      supplierId: 'sup-1',
    }
    const data = productDraftToData(draft)
    expect(data.supplierCode).toBe('LDW')
    expect(data.costPrice).toBe(13) // Math.round(12.5)
    expect(data.sellPrice).toBe(20_000)
    expect(data.reorderPoint).toBe(3)
    expect(data.supplierId).toBe('sup-1')
  })

  it('maps a blank supplierId to null', () => {
    const data = productDraftToData({ ...initialProductDraft(null), supplierId: '' })
    expect(data.supplierId).toBeNull()
  })

  it('carries the schedule-item override through scheduleItemFromDraft', () => {
    const data = productDraftToData({ ...initialProductDraft(null), scheduleItemOverride: NO_SCHEDULE_ITEM })
    expect(data.serviceItemTypeId).toBeNull()
  })
})

describe('duplicateResolution', () => {
  function match(field: 'name' | 'sku' = 'name'): ProductDuplicate {
    return { product: product(), field }
  }

  it('is "none" with no duplicate', () => {
    expect(duplicateResolution(null, true, 5)).toEqual({ kind: 'none' })
  })

  it('offers a restock for a new product, name clash, with stock to add', () => {
    const r = duplicateResolution(match('name'), true, 5)
    expect(r.kind).toBe('offerRestock')
  })

  it('blocks a name clash on an EDIT (not a new product)', () => {
    const r = duplicateResolution(match('name'), false, 5)
    expect(r).toEqual({ kind: 'blocked', field: 'name', product: expect.any(Object) })
  })

  it('blocks a name clash with zero incoming quantity', () => {
    const r = duplicateResolution(match('name'), true, 0)
    expect(r.kind).toBe('blocked')
  })

  it('always blocks a SKU clash, even for a new product with stock to add', () => {
    const r = duplicateResolution(match('sku'), true, 5)
    expect(r).toEqual({ kind: 'blocked', field: 'sku', product: expect.any(Object) })
  })
})

describe('duplicateResolutionToast', () => {
  const t = (key: string, vars?: Record<string, string>) => `${key}:${vars?.product ?? ''}`

  it('is null when nothing is blocked', () => {
    expect(duplicateResolutionToast({ kind: 'none' }, t)).toBeNull()
    expect(duplicateResolutionToast({ kind: 'offerRestock', product: product() }, t)).toBeNull()
  })

  it('names the right error key per field', () => {
    const nameToast = duplicateResolutionToast({ kind: 'blocked', field: 'name', product: product() }, t)
    expect(nameToast?.title).toContain('inventory.duplicateNameError')
    const skuToast = duplicateResolutionToast({ kind: 'blocked', field: 'sku', product: product() }, t)
    expect(skuToast?.title).toContain('inventory.duplicateSkuError')
  })
})

describe('initialPurchase', () => {
  it('is null when the checkbox is off', () => {
    expect(initialPurchase(false, 10, 100, 'Vendor', 'Product')).toBeNull()
  })

  it('is null for a zero or negative quantity, even with the checkbox on', () => {
    expect(initialPurchase(true, 0, 100, 'Vendor', 'Product')).toBeNull()
  })

  it('computes amount as qty * unitCost', () => {
    expect(initialPurchase(true, 10, 100, 'Vendor', 'Product')).toEqual({
      amount: 1000,
      vendor: 'Vendor',
      description: 'Product',
    })
  })
})
