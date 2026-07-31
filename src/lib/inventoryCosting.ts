// FIFO costing over lot balances. Pure — no store access, same as
// orderLifecycle.ts/scheduleEngine.ts: callers read the lots and apply the
// result. This module owns the invariant that a sale is costed at what the
// shop actually paid for the specific stock it consumed, oldest batch first.
//
// Deliberately decoupled from StockLot (src/store/stockLotStore.ts): a stored
// lot row carries no remaining-quantity field — that's derived from the stock
// ledger — so callers hydrate lots into a LotBalance (see
// src/lib/stockLedger.ts's hydrateLots) before calling anything here.
export interface LotBalance {
  id: string
  productId: string
  unitCost: number
  qtyRemaining: number
  receivedAt: string
}

export interface LotConsumption {
  lotId: string
  quantity: number
  unitCost: number
}

export interface FifoDraw {
  consumptions: LotConsumption[]
  /** Whole Rupiah paid for the quantity the lots could cover. */
  cost: number
  /** Quantity no lot could cover — the caller prices it at Product.costPrice. */
  shortfallQty: number
}

/** Live lots, oldest first. Empty lots drop out; they can't be drawn from. */
function drawable(lots: LotBalance[]): LotBalance[] {
  return lots
    .filter((lot) => lot.qtyRemaining > 0)
    .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt))
}

/**
 * Draw `qty` from `lots`, oldest first. One draw can span several lots at
 * different prices — that's the whole point, and why callers store the
 * returned total rather than a unit cost.
 *
 * `shortfallQty` is not an error: stock can legitimately exist without a lot
 * (rows predating lot tracking, or a stock addition with no purchase
 * recorded). Callers cost it at the product's current price so a line is
 * never valued at zero.
 */
export function drawFifo(lots: LotBalance[], qty: number): FifoDraw {
  const consumptions: LotConsumption[] = []
  let remaining = Math.max(0, qty)
  let cost = 0

  for (const lot of drawable(lots)) {
    if (remaining <= 0) break
    const take = Math.min(lot.qtyRemaining, remaining)
    consumptions.push({ lotId: lot.id, quantity: take, unitCost: lot.unitCost })
    cost += Math.round(take * lot.unitCost)
    remaining -= take
  }

  return { consumptions, cost, shortfallQty: remaining }
}

/** What the stock on hand is worth: Σ qtyRemaining × unitCost. */
export function lotInventoryValue(lots: LotBalance[]): number {
  return lots.reduce((sum, lot) => sum + Math.round(lot.qtyRemaining * lot.unitCost), 0)
}

/**
 * lotInventoryValue, grouped by product — for callers valuing many products at
 * once (e.g. a report) who'd otherwise filter `lots` per product in a loop.
 */
export function lotValueByProduct(lots: LotBalance[]): Map<string, number> {
  const byProduct = new Map<string, number>()
  for (const lot of lots) {
    byProduct.set(lot.productId, (byProduct.get(lot.productId) ?? 0) + Math.round(lot.qtyRemaining * lot.unitCost))
  }
  return byProduct
}

/**
 * Weighted average unit cost of what's left — for display only (the Inventory
 * cost column). null when nothing remains, so callers can fall back to the
 * product's own cost price rather than show 0.
 */
export function averageUnitCost(lots: LotBalance[]): number | null {
  const qty = lots.reduce((sum, lot) => sum + lot.qtyRemaining, 0)
  if (qty <= 0) return null
  return lotInventoryValue(lots) / qty
}
