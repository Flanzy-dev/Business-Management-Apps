// Pure work-order lifecycle transitions. This module owns the invariant:
// a work order's stock effect happens exactly once — deducted when the order
// transitions open → completed, restored if a completed order is deleted.
// No store access here; callers (src/lib/ops/) apply the returned effects.
import type { WorkOrder, WorkOrderItem } from '../store/workOrderStore'

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
    return { ok: false, reason: 'Order is already completed.' }
  }
  if (order.status === 'cancelled') {
    return { ok: false, reason: 'Cancelled orders cannot be completed.' }
  }
  if (order.items.length === 0) {
    return { ok: false, reason: 'Add at least one item before completing.' }
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
