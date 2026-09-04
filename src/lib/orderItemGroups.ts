// Shared by the on-screen work-order item table and the standalone
// printReceipt HTML builder, so both split Products from Services the same
// way and can't drift (same pattern as src/lib/receiptDueLines.ts for
// due-service lines).
import type { WorkOrderItem } from '../store/workOrderStore'

export interface OrderItemGroups {
  products: WorkOrderItem[]
  services: WorkOrderItem[]
  productsSubtotal: number
  servicesSubtotal: number
}

/**
 * Display-only Product/Service classification for one line. A stock-linked
 * line is always 'product' — its productId is ground truth, not a choice.
 * Otherwise falls back to the explicit `kind` a custom item was tagged with
 * (src/components/workOrders/LineItemDialog.tsx), and finally to `!!productId`
 * for every line added before `kind` existed, so nothing already on an order
 * silently reclassifies.
 *
 * Deliberately NOT what costing keys off: src/lib/finance.ts's
 * computeCogsBreakdown stays keyed on productId alone, because only a real
 * inventory line has a recorded cost behind it — an uncosted custom "product"
 * line must never be able to inflate the parts gross margin.
 */
export function itemKind(item: WorkOrderItem): 'product' | 'service' {
  if (item.productId) return 'product'
  return item.kind ?? 'service'
}

/** Split a work order's line items into Products and Services for display —
 *  the ticket and the printed receipt. See itemKind() for the rule. */
export function groupOrderItemsByType(items: WorkOrderItem[]): OrderItemGroups {
  const products = items.filter(i => itemKind(i) === 'product')
  const services = items.filter(i => itemKind(i) === 'service')
  return {
    products,
    services,
    productsSubtotal: products.reduce((sum, i) => sum + i.lineTotal, 0),
    servicesSubtotal: services.reduce((sum, i) => sum + i.lineTotal, 0),
  }
}
