// Pure work-order lifecycle transitions. This module owns the invariant:
// a work order's stock effect happens exactly once — deducted when the order
// transitions open → completed, restored if a completed order is deleted.
// No store access here; callers (src/lib/ops/) apply the returned effects.
import type { WorkOrder, WorkOrderItem } from '../store/workOrderStore'
import { translate } from './i18n'

export interface StockAdjustment {
  productId: string
  /** Positive adds stock, negative deducts — matches inventoryStore.adjustStock. */
  delta: number
}

export type CompletionResult =
  | { ok: true; order: WorkOrder; stockAdjustments: StockAdjustment[] }
  | { ok: false; reason: string }

/** Net stock delta per product across all product-linked lines (merges duplicates). */
function stockDeltas(items: WorkOrderItem[], sign: 1 | -1): StockAdjustment[] {
  const byProduct = new Map<string, number>()
  for (const item of items) {
    if (!item.productId) continue
    byProduct.set(item.productId, (byProduct.get(item.productId) ?? 0) + item.quantity * sign)
  }
  return [...byProduct.entries()].map(([productId, delta]) => ({ productId, delta }))
}

/**
 * How much more of `product` this order can still take: stock on hand minus the
 * quantity already reserved by the order's own lines. Merges duplicate lines of
 * the same product, so adding one product across several lines can't sell past
 * what's on the shelf. Pure — the checkout catalog uses it to disable a tile and
 * the line editor to cap a quantity, while `firstInsufficientStockProduct` below
 * stays the last-line guard at completion time.
 */
export function remainingStock(
  items: WorkOrderItem[],
  product: { id: string; qtyOnHand: number }
): number {
  const reserved = items
    .filter((item) => item.productId === product.id)
    .reduce((sum, item) => sum + item.quantity, 0)
  return product.qtyOnHand - reserved
}

/**
 * open → completed. Returns the completed order plus the inventory deductions
 * that must be applied with it. Rejects re-completion (which would
 * double-deduct stock) and empty orders.
 *
 * `paymentDueDate` is only ever carried onto the order when paymentMethod is
 * 'pending' — a cash/qris/card/check sale is settled the moment it completes,
 * so it can never end up holding a due date (src/lib/receivables.ts reads
 * `paymentMethod === 'pending'` as the sole signal that a debt exists).
 */
export function applyCompletion(
  order: WorkOrder,
  paymentMethod: WorkOrder['paymentMethod'],
  paymentDueDate: string | null = null,
  now: Date = new Date()
): CompletionResult {
  if (order.status === 'completed') {
    return { ok: false, reason: translate('workOrders.orderAlreadyCompletedError') }
  }
  if (order.status === 'cancelled') {
    return { ok: false, reason: translate('workOrders.orderCancelledCannotCompleteError') }
  }
  if (order.items.length === 0) {
    return { ok: false, reason: translate('workOrders.orderNoItemsError') }
  }
  return {
    ok: true,
    order: {
      ...order,
      status: 'completed',
      paymentMethod,
      completedAt: now.toISOString(),
      paymentDueDate: paymentMethod === 'pending' ? paymentDueDate : null,
    },
    stockAdjustments: stockDeltas(order.items, -1),
  }
}

export type PaymentResult =
  | { ok: true; order: WorkOrder }
  | { ok: false; reason: string }

/**
 * Collect a completed order's outstanding debt: flips paymentMethod from
 * 'pending' to whatever it was actually paid with and stamps paidAt/
 * amountReceived. No stock/lot/movement/schedule effect — the sale already
 * completed, so the parts already left the shelf; this only settles how it
 * was paid. Rejects an order that isn't completed, one that isn't currently
 * 'pending' (already collected, or never unpaid — guards double-collection),
 * and 'pending' itself as the settling method.
 */
export function applyPayment(
  order: WorkOrder,
  method: WorkOrder['paymentMethod'],
  amountReceived: number | null,
  now: Date = new Date()
): PaymentResult {
  if (order.status !== 'completed') {
    return { ok: false, reason: translate('workOrders.orderNotCompletedError') }
  }
  if (order.paymentMethod !== 'pending') {
    return { ok: false, reason: translate('workOrders.orderAlreadyPaidError') }
  }
  if (method === 'pending') {
    return { ok: false, reason: translate('workOrders.paymentMethodRequiredError') }
  }
  return {
    ok: true,
    order: {
      ...order,
      paymentMethod: method,
      amountReceived,
      paidAt: now.toISOString(),
    },
  }
}

/**
 * Stock restorations owed when an order is removed: a completed order already
 * consumed stock, so deleting it puts the parts back; open/cancelled orders
 * never deducted anything.
 */
export function deletionStockRestorations(order: WorkOrder): StockAdjustment[] {
  if (order.status !== 'completed') return []
  return stockDeltas(order.items, 1)
}

export type VoidResult =
  | { ok: true; order: WorkOrder; stockRestorations: StockAdjustment[] }
  | { ok: false; reason: string }

/**
 * completed → cancelled (voided). Unlike a delete, the row is kept — the sale
 * stays in history with a reason. Returns the updated order plus the stock that
 * must be put back (a completed order already deducted it). Only a completed
 * order can be voided.
 */
export function applyVoid(order: WorkOrder, reason: string, now: Date = new Date()): VoidResult {
  if (order.status !== 'completed') {
    return { ok: false, reason: translate('workOrders.orderNotVoidableError') }
  }
  return {
    ok: true,
    order: {
      ...order,
      status: 'cancelled',
      voidedAt: now.toISOString(),
      voidReason: reason,
    },
    stockRestorations: deletionStockRestorations(order),
  }
}

/**
 * Last-line guard before a completion's stock deductions are applied: returns
 * the id of the first product whose current stock can't cover its deduction,
 * or null if every deduction is coverable. This is the choke point for the
 * deduct-once invariant — it must hold no matter what UI guard (if any) let
 * the items onto the order in the first place. Pure; callers (src/lib/ops/)
 * supply current qtyOnHand per product and must reject completion — applying
 * no mutation — when this returns non-null.
 */
export function firstInsufficientStockProduct(
  stockAdjustments: StockAdjustment[],
  qtyOnHand: (productId: string) => number | undefined
): string | null {
  for (const adj of stockAdjustments) {
    if (adj.delta >= 0) continue // restorations never fail for lack of stock
    const available = qtyOnHand(adj.productId)
    if (available != null && -adj.delta > available) return adj.productId
  }
  return null
}
