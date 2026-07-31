// Derives everything about "how much stock is there" from the append-only
// stock ledger (src/store/stockMovementStore.ts) — nothing here is ever
// stored. Pure, no store access, same shape as orderLifecycle.ts and
// inventoryCosting.ts: callers read the movements and pass them in.
//
// This is the seam that makes multi-device stock safe. A stored counter
// (the old Product.qtyOnHand) can only ever hold one device's last write; a
// sum over movements holds every device's movements at once, in any order —
// two offline sales of the same product are two rows that both survive being
// merged back together.
import type { Product } from '../store/inventoryStore'
import type { StockLot } from '../store/stockLotStore'
import type { StockMovement } from '../store/stockMovementStore'
import type { LotBalance } from './inventoryCosting'

/** A product enriched with its derived quantity on hand — the read path every
 *  page/component uses in place of the old stored Product.qtyOnHand. */
export type ProductWithStock = Product & { qtyOnHand: number }

/** Σ delta per product, in one pass — for callers enriching many products at once. */
export function qtyByProduct(movements: StockMovement[]): Map<string, number> {
  const totals = new Map<string, number>()
  for (const m of movements) {
    totals.set(m.productId, (totals.get(m.productId) ?? 0) + m.delta)
  }
  return totals
}

/** Current stock for one product. Never clamped — see StockMovement.delta. */
export function qtyOnHand(movements: StockMovement[], productId: string): number {
  let total = 0
  for (const m of movements) {
    if (m.productId === productId) total += m.delta
  }
  return total
}

/** Every product enriched with its derived qtyOnHand. */
export function withStock(products: Product[], movements: StockMovement[]): ProductWithStock[] {
  const totals = qtyByProduct(movements)
  return products.map((p) => ({ ...p, qtyOnHand: totals.get(p.id) ?? 0 }))
}

/**
 * Hydrate stored lot rows into live balances: qtyRemaining is Σ delta of every
 * movement that references the lot's id (its opening/purchase movement plus
 * every draw against it since). Sorted oldest-received first, the order
 * src/lib/inventoryCosting.ts's drawFifo expects.
 */
export function hydrateLots(lots: StockLot[], movements: StockMovement[]): LotBalance[] {
  const remainingByLot = new Map<string, number>()
  for (const m of movements) {
    if (!m.lotId) continue
    remainingByLot.set(m.lotId, (remainingByLot.get(m.lotId) ?? 0) + m.delta)
  }
  return lots
    .map((lot) => ({
      id: lot.id,
      productId: lot.productId,
      unitCost: lot.unitCost,
      receivedAt: lot.receivedAt,
      qtyRemaining: remainingByLot.get(lot.id) ?? 0,
    }))
    .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt))
}

/** hydrateLots, pre-filtered to one product — the common case at a call site. */
export function lotsByProduct(lots: StockLot[], movements: StockMovement[], productId: string): LotBalance[] {
  return hydrateLots(
    lots.filter((lot) => lot.productId === productId),
    movements
  )
}

/** Products at or under their reorder point. */
export function lowStockProducts(products: Product[], movements: StockMovement[]): ProductWithStock[] {
  return withStock(products, movements).filter((p) => p.qtyOnHand <= p.reorderPoint)
}

/**
 * Products whose derived stock has gone negative — a real oversell (two
 * offline devices both selling the last unit), surfaced rather than clamped
 * away. See the Inventory page's reconcile action for how this gets resolved.
 */
export function negativeStockProducts(products: Product[], movements: StockMovement[]): ProductWithStock[] {
  return withStock(products, movements).filter((p) => p.qtyOnHand < 0)
}
