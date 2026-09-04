// AdjustStockDialog's cost/average math, pulled out of the JSX (it used to
// live in an IIFE inside the render body) and the Save handler — the same
// "real numbers belong in a plain .ts, not a component body" reasoning as
// every other *Form.ts module in this codebase. Pure — callers pass the
// product's current qtyOnHand/costPrice and the blended average cost of its
// on-hand stock (useProductLots' averageCost, or costPrice with no lots) in.
import type { StockPurchase } from './ops/inventoryOps'
import type { Supplier } from '../store/supplierStore'

export type AdjustType = 'add' | 'subtract'

/** The vendor name to prefill from a product's own supplierId, or '' with
 *  none on file — the dialog resets to this every time it opens. */
export function supplierNameById(suppliers: Supplier[], id: string | null): string {
  if (!id) return ''
  return suppliers.find((s) => s.id === id)?.name || ''
}

/** The purchase amount an arrival records — the typed override once the cost
 *  field has been hand-edited, else qty × the product's list cost price. */
export function purchaseAmount(qty: number, costEdited: boolean, expenseCost: string, costPrice: number): number {
  return costEdited ? Math.round(parseFloat(expenseCost) || 0) : qty * costPrice
}

/**
 * What this purchase does to the blended cost of stock on hand — the batch
 * arrives as its own FIFO lot at amount/qty, it does not overwrite the old
 * stock's cost. Zero once the resulting qtyOnHand would be zero (nothing to
 * average over).
 */
export function newAverageCostAfterPurchase(qtyOnHand: number, unitCost: number, qty: number, amount: number): number {
  const onHandValue = Math.round(unitCost * qtyOnHand)
  const nextQty = qtyOnHand + qty
  return nextQty > 0 ? Math.round((onHandValue + amount) / nextQty) : 0
}

/**
 * Builds the purchase to record for an arrival, or `null` when this
 * adjustment shouldn't touch expenses at all — either it's a subtraction, or
 * the shop chose not to record this arrival as a cost.
 */
export function restockPurchase(
  type: AdjustType,
  withExpense: boolean,
  qty: number,
  costEdited: boolean,
  expenseCost: string,
  costPrice: number,
  vendor: string,
  description: string
): StockPurchase | null {
  if (type !== 'add' || !withExpense) return null
  return { amount: purchaseAmount(qty, costEdited, expenseCost, costPrice), vendor, description }
}
