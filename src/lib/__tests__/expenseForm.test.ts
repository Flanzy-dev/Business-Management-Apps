// The Add/Edit Expense dialog's rules, now that they live outside the page
// (see ../expenseForm.ts's header for why). The cases worth having are the
// ones a hand-written-inline version could get subtly wrong: the vendorMode
// fallback for a legacy vendor string, the linked-purchase gate, and the
// auto-fill-stops-once-edited rule.
import { describe, it, expect } from 'vitest'
import {
  initialExpenseDraft,
  expenseDraftFrom,
  validateExpenseDraft,
  expenseDraftToData,
  linkedPurchaseFrom,
  autoFillFromQuantity,
  filterExpenses,
  type ExpenseDraft,
} from '../expenseForm'
import type { Expense } from '../../store/expenseStore'
import type { Supplier } from '../../store/supplierStore'

function expense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 'e-1',
    date: '2026-01-15',
    category: 'Rent',
    description: 'January rent',
    amount: 5_000_000,
    vendor: 'Landlord Co',
    notes: '',
    createdAt: '2026-01-15T00:00:00.000Z',
    productId: null,
    quantityAffected: null,
    ...overrides,
  }
}

function supplier(overrides: Partial<Supplier> = {}): Supplier {
  return { id: 's-1', name: 'Landlord Co', phone: '', email: '', address: '', notes: '', createdAt: '2026-01-01T00:00:00.000Z', ...overrides }
}

describe('initialExpenseDraft', () => {
  it('starts blank with today\'s date and the first category', () => {
    const draft = initialExpenseDraft()
    expect(draft.description).toBe('')
    expect(draft.vendorMode).toBe('select')
    expect(draft.amountEdited).toBe(false)
    expect(draft.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('expenseDraftFrom', () => {
  it('mirrors an existing expense\'s values', () => {
    const draft = expenseDraftFrom(expense(), [supplier()])
    expect(draft.description).toBe('January rent')
    expect(draft.amount).toBe('5000000')
    expect(draft.vendorMode).toBe('select')
  })

  it('falls back to "other" vendor mode when the vendor no longer matches any supplier', () => {
    const draft = expenseDraftFrom(expense({ vendor: 'A Supplier That No Longer Exists' }), [supplier()])
    expect(draft.vendorMode).toBe('other')
  })

  it('stays in "select" mode with a blank vendor', () => {
    const draft = expenseDraftFrom(expense({ vendor: '' }), [supplier()])
    expect(draft.vendorMode).toBe('select')
  })
})

describe('validateExpenseDraft', () => {
  function draft(overrides: Partial<ExpenseDraft> = {}): ExpenseDraft {
    return { ...initialExpenseDraft(), description: 'Something', amount: '1000', ...overrides }
  }

  it('passes a filled-in draft', () => {
    expect(validateExpenseDraft(draft())).toEqual({ ok: true })
  })

  it('flags a blank description', () => {
    expect(validateExpenseDraft(draft({ description: '  ' }))).toEqual({
      ok: false,
      descriptionRequired: true,
      amountRequired: false,
    })
  })

  it('flags a blank amount', () => {
    expect(validateExpenseDraft(draft({ amount: '' }))).toEqual({
      ok: false,
      descriptionRequired: false,
      amountRequired: true,
    })
  })
})

describe('expenseDraftToData', () => {
  it('rounds the amount', () => {
    const data = expenseDraftToData({ ...initialExpenseDraft(), amount: '1000.6' })
    expect(data.amount).toBe(1001)
  })
})

describe('linkedPurchaseFrom', () => {
  function draft(overrides: Partial<ExpenseDraft> = {}): ExpenseDraft {
    return { ...initialExpenseDraft(), category: 'Inventory Purchase', linkedProductId: 'p-1', linkedQty: '5', ...overrides }
  }

  it('links when category, product, and a positive quantity are all set', () => {
    expect(linkedPurchaseFrom(draft())).toEqual({ productId: 'p-1', quantity: 5 })
  })

  it('is null for any other category, even with a product/qty set', () => {
    expect(linkedPurchaseFrom(draft({ category: 'Rent' }))).toBeNull()
  })

  it('is null with no product selected', () => {
    expect(linkedPurchaseFrom(draft({ linkedProductId: '' }))).toBeNull()
  })

  it('is null with a zero or blank quantity', () => {
    expect(linkedPurchaseFrom(draft({ linkedQty: '0' }))).toBeNull()
    expect(linkedPurchaseFrom(draft({ linkedQty: '' }))).toBeNull()
  })
})

describe('autoFillFromQuantity', () => {
  const product = { costPrice: 50_000, name: 'Mobil 1 5W-30' }

  it('fills both amount and description when neither has been touched', () => {
    expect(autoFillFromQuantity('3', product, '', false)).toEqual({ amount: '150000', description: 'Mobil 1 5W-30' })
  })

  it('never overwrites amount once the user has edited it directly', () => {
    expect(autoFillFromQuantity('3', product, '', true)).toEqual({ description: 'Mobil 1 5W-30' })
  })

  it('never overwrites a description the user already typed', () => {
    expect(autoFillFromQuantity('3', product, 'My own description', false)).toEqual({ amount: '150000' })
  })

  it('fills nothing with no product resolved', () => {
    expect(autoFillFromQuantity('3', undefined, '', false)).toEqual({})
  })

  it('fills nothing for a zero or blank quantity', () => {
    expect(autoFillFromQuantity('0', product, '', false)).toEqual({})
    expect(autoFillFromQuantity('', product, '', false)).toEqual({})
  })
})

describe('filterExpenses', () => {
  const jan = expense({ id: 'e-jan', date: '2026-01-10', category: 'Rent' })
  const feb = expense({ id: 'e-feb', date: '2026-02-10', category: 'Utilities' })
  const all = [jan, feb]

  it('returns everything, newest first, with no filters', () => {
    expect(filterExpenses(all, '', '').map((e) => e.id)).toEqual(['e-feb', 'e-jan'])
  })

  it('filters by category', () => {
    expect(filterExpenses(all, 'Rent', '').map((e) => e.id)).toEqual(['e-jan'])
  })

  it('filters by month', () => {
    expect(filterExpenses(all, '', '2026-02').map((e) => e.id)).toEqual(['e-feb'])
  })

  it('combines both filters', () => {
    expect(filterExpenses(all, 'Rent', '2026-02')).toEqual([])
  })
})
