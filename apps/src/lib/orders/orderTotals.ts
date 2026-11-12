// The money rule of a work order, in one place: what a line comes to, and
// what the order comes to from its lines. Whole Rupiah throughout (AGENTS.md:
// IDR has no minor unit in practice).
//
// This used to be private to workOrderStore.ts, which meant anything building
// an order outside the store's own addItem path — the Excel-history import
// (src/lib/ops/customerHistoryImportOps.ts) was the first — had to restate it,
// and an order whose total disagrees with its lines is exactly the kind of
// error a report quietly sums.

/** A line's total: quantity × unit price, rounded to whole Rupiah (quantities can be fractional litres). */
export function lineTotal(quantity: number, unitPrice: number): number {
  return Math.round(quantity * unitPrice)
}

export interface OrderTotals {
  subtotal: number
  /** The discount actually applied — clamped to [0, subtotal]. */
  discountAmount: number
  taxAmount: number
  total: number
}

/**
 * Subtotal from the lines' own `lineTotal`s, then discount, then tax on what's
 * left. The discount is clamped in what's stored and shown, not just in what
 * the total floors to — an over-entered discount (a typo, or lines removed
 * after typing a big one) must never print "Discount: -Rp150.000" above
 * "Total: Rp0" on a Rp100.000 order.
 */
export function computeOrderTotals(
  items: { lineTotal: number }[],
  discountAmount: number,
  taxPercent: number
): OrderTotals {
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0)
  const clampedDiscount = Math.min(Math.max(0, discountAmount), subtotal)
  const afterDiscount = subtotal - clampedDiscount
  const taxAmount = Math.round(afterDiscount * (taxPercent / 100))
  return { subtotal, discountAmount: clampedDiscount, taxAmount, total: afterDiscount + taxAmount }
}
