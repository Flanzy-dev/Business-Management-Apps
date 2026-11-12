// What the stock ledger already says about one work order. Pure — callers pass
// the movements in, same as stockLedger.ts.
//
// Why this exists: completing an order appends 'sale' movements and voiding or
// deleting it appends 'sale-reversal' ones, but the order row itself is
// last-write-wins across devices while the ledger is append-only. A tablet that
// hadn't yet pulled the completion can push the order back as 'open', and a
// second completion would then take the same stock out again. Asking the
// ledger "is this order's stock already out?" — rather than trusting the order's
// status — makes completion and reversal safe to repeat.
import type { StockMovement } from '../../store/stockMovementStore'
import { roundQty } from '../inventory/quantity'

/** What the ledger holds for one product on one work order. */
export interface RecordedStock {
  /** Quantity currently out of stock on this order's account: −Σ delta over
   *  every movement tied to it. Positive means taken and not yet put back. */
  netOut: number
  /** Quantity the 'sale' movements took, and what it cost (whole Rupiah) —
   *  what a restore puts back, and at what price. */
  soldQty: number
  soldCost: number
}

/** The ledger's record of one work order, per product. A product the order
 *  never moved has no entry; an empty map means the ledger knows nothing of
 *  this order (never completed, or completed before the ledger existed). */
export function recordedStockForOrder(movements: StockMovement[], orderId: string): Map<string, RecordedStock> {
  const byProduct = new Map<string, RecordedStock>()
  for (const m of movements) {
    if (m.refType !== 'workOrder' || m.refId !== orderId) continue
    const entry = byProduct.get(m.productId) ?? { netOut: 0, soldQty: 0, soldCost: 0 }
    entry.netOut -= m.delta
    if (m.reason === 'sale') {
      entry.soldQty += -m.delta
      entry.soldCost += Math.round(-m.delta * m.unitCost)
    }
    byProduct.set(m.productId, entry)
  }
  for (const entry of byProduct.values()) {
    entry.netOut = roundQty(entry.netOut)
    entry.soldQty = roundQty(entry.soldQty)
  }
  return byProduct
}

/** Split a whole-Rupiah `total` across lines in proportion to `quantities`,
 *  the last line taking the rounding remainder so the parts always sum to
 *  `total` exactly. */
export function allocateCost(total: number, quantities: number[]): number[] {
  const sum = quantities.reduce((a, b) => a + b, 0)
  if (sum <= 0) return quantities.map(() => 0)
  let left = total
  return quantities.map((q, i) => {
    if (i === quantities.length - 1) return left
    const share = Math.round((total * q) / sum)
    left -= share
    return share
  })
}
