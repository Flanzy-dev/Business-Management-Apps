// The Add/Edit Expense dialog's own rules, pulled out of the page that
// renders it (src/pages/Expenses.tsx) — same reasoning as productForm.ts/
// newOrderForm.ts. `autoFillFromQuantity` is a real bookkeeping rule (auto-
// computing amount = qty × cost price, and suggesting a description) that
// used to be buried inside a change handler.
import { EXPENSE_CATEGORIES, type Expense } from '../store/expenseStore'
import type { Supplier } from '../store/supplierStore'

const INVENTORY_PURCHASE_CATEGORY = 'Inventory Purchase'

export type VendorMode = 'select' | 'other'

export interface ExpenseDraft {
  date: string
  category: string
  description: string
  amount: string
  vendor: string
  /** Vendor is a plain string on Expense (no schema change) — this just
   *  controls whether the form shows the Supplier <Select> or a free-text
   *  <Input> for a vendor that isn't a registered Supplier. */
  vendorMode: VendorMode
  notes: string
  /** Product link — create mode only. See linkedPurchaseFrom. */
  linkedProductId: string
  linkedQty: string
  /** Once true, autoFillFromQuantity stops overwriting `amount` — the user
   *  typed their own figure and a later quantity edit shouldn't clobber it. */
  amountEdited: boolean
}

/** A brand-new, blank expense draft — today's date, the first category. */
export function initialExpenseDraft(): ExpenseDraft {
  return {
    date: new Date().toISOString().split('T')[0],
    category: EXPENSE_CATEGORIES[0],
    description: '',
    amount: '',
    vendor: '',
    vendorMode: 'select',
    notes: '',
    linkedProductId: '',
    linkedQty: '',
    amountEdited: false,
  }
}

/** An existing expense's values, for editing. `suppliers` decides vendorMode:
 *  a legacy/custom vendor string that no longer matches any Supplier shows
 *  in "Other" mode instead of appearing to silently reset. */
export function expenseDraftFrom(expense: Expense, suppliers: Supplier[]): ExpenseDraft {
  return {
    date: expense.date,
    category: expense.category,
    description: expense.description,
    amount: expense.amount.toString(),
    vendor: expense.vendor,
    vendorMode: expense.vendor && !suppliers.some((s) => s.name === expense.vendor) ? 'other' : 'select',
    notes: expense.notes,
    linkedProductId: '',
    linkedQty: '',
    amountEdited: false,
  }
}

export type ExpenseDraftValidation =
  | { ok: true }
  | { ok: false; descriptionRequired: boolean; amountRequired: boolean }

export function validateExpenseDraft(draft: ExpenseDraft): ExpenseDraftValidation {
  const descriptionRequired = !draft.description.trim()
  const amountRequired = !draft.amount
  if (!descriptionRequired && !amountRequired) return { ok: true }
  return { ok: false, descriptionRequired, amountRequired }
}

/** The stored-shape fields both addExpense (via recordExpense) and
 *  updateExpense take. */
export function expenseDraftToData(
  draft: ExpenseDraft
): Omit<Expense, 'id' | 'createdAt' | 'productId' | 'quantityAffected'> {
  return {
    date: draft.date,
    category: draft.category,
    description: draft.description,
    amount: Math.round(parseFloat(draft.amount) || 0),
    vendor: draft.vendor,
    notes: draft.notes,
  }
}

/** The linked-product purchase for a brand-new Inventory Purchase expense —
 *  null unless the category, product, and quantity are all actually set. */
export function linkedPurchaseFrom(draft: ExpenseDraft): { productId: string; quantity: number } | null {
  const qty = parseFloat(draft.linkedQty) || 0
  if (draft.category !== INVENTORY_PURCHASE_CATEGORY || !draft.linkedProductId || qty <= 0) return null
  return { productId: draft.linkedProductId, quantity: qty }
}

export interface QuantityAutoFill {
  amount?: string
  description?: string
}

/**
 * Quantity changed on a linked-product expense — auto-fill amount (qty ×
 * cost price) and, if the user hasn't typed a description yet, suggest one.
 * Both stop once the user edits amount directly (amountEdited), same
 * convention as the Adjust Stock dialog in src/pages/Inventory.tsx. Returns
 * only the fields that should change, so the caller applies them without
 * guessing which ones were left alone.
 */
export function autoFillFromQuantity(
  qtyText: string,
  product: { costPrice: number; name: string } | undefined,
  currentDescription: string,
  amountEdited: boolean
): QuantityAutoFill {
  const qty = parseFloat(qtyText) || 0
  if (!product || qty <= 0) return {}
  const fill: QuantityAutoFill = {}
  if (!amountEdited) fill.amount = String(qty * product.costPrice)
  if (!currentDescription.trim()) fill.description = product.name
  return fill
}

/** Category + month filters, applied in that order, then newest-first. */
export function filterExpenses(expenses: Expense[], filterCategory: string, filterMonth: string): Expense[] {
  let filtered = expenses
  if (filterCategory) filtered = filtered.filter((e) => e.category === filterCategory)
  if (filterMonth) filtered = filtered.filter((e) => e.date.startsWith(filterMonth))
  return [...filtered].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}
