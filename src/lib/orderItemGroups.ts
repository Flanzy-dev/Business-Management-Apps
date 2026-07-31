// Shared by the on-screen work-order item table, the Receipt React preview,
// and the standalone printReceipt HTML builder, so all three split Products
// from Services the same way and can't drift (same pattern as
// src/lib/receiptDueLines.ts for due-service lines).
import type { WorkOrderItem } from '../store/workOrderStore'

export interface OrderItemGroups {
  products: WorkOrderItem[]
  services: WorkOrderItem[]
  productsSubtotal: number
  servicesSubtotal: number
}

/**
 * Split a work order's line items into Products (came from the inventory
 * tab — `productId` set) and Services (manual/labor lines — no `productId`).
 * This is independent of `serviceItemTypeId`, which only marks
 * schedule-tracking, not product-vs-service.
 */
export function groupOrderItemsByType(items: WorkOrderItem[]): OrderItemGroups {
  const products = items.filter(i => i.productId)
  const services = items.filter(i => !i.productId)
  return {
    products,
    services,
    productsSubtotal: products.reduce((sum, i) => sum + i.lineTotal, 0),
    servicesSubtotal: services.reduce((sum, i) => sum + i.lineTotal, 0),
  }
}
