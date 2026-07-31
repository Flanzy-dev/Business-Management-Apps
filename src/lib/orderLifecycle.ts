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
 */
export function applyCompletion(
  order: WorkOrder,
  paymentMethod: WorkOrder['paymentMethod'],
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
    },
    stockAdjustments: stockDeltas(order.items, -1),
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
