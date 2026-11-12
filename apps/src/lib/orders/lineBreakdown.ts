import type { WorkOrderItem } from '../../store/workOrderStore'
import { formatCurrency, formatNumber } from '../format/numbers'

/**
 * "2 × Rp 110.000" — what one unit costs times how many, for the receipt and
 * the order details, so the total beside it is never a number to take on
 * trust. null for a single unit: "1 × Rp 50.000" next to "Rp 50.000" is noise.
 */
export function lineBreakdown(item: Pick<WorkOrderItem, 'quantity' | 'unitPrice'>): string | null {
  if (item.quantity === 1) return null
  return `${formatNumber(item.quantity)} × ${formatCurrency(item.unitPrice)}`
}
