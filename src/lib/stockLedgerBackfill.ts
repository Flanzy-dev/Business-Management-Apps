// Pure half of the one-time move from stored quantity counters
// (Product.qtyOnHand, StockLot.qtyRemaining) to the append-only stock ledger
// (src/store/stockMovementStore.ts, src/lib/stockLedger.ts). The store-writing
// half is src/lib/ops/stockLedgerBackfill.ts.
//
// Both source fields were removed from their store types by this move — a
// stored counter is exactly the thing an offline multi-device merge can't
// resolve safely (see CLAUDE.md's inventory-costing note) — but an install
// that ran before this migration still has them sitting in its persisted
// JSON. This reads them loosely, by name, off already-persisted data; it is
// not meant to be called with freshly-typed objects that never carried them.
import type { StockLot } from '../store/stockLotStore'
import type { StockMovement } from '../store/stockMovementStore'

/** The shape a Product row had before qtyOnHand moved to the ledger. */
export interface LegacyProduct {
  id: string
  costPrice: number
  createdAt: string
  qtyOnHand?: number
}

/** The shape a StockLot row had before qtyRemaining moved to the ledger. */
export interface LegacyStockLot {
  id: string
  productId: string
  unitCost: number
  receivedAt: string
  qtyRemaining?: number
}

type NewMovement = Omit<StockMovement, 'id' | 'createdAt' | 'deviceId'>

export interface LedgerBackfillResult {
  /**
   * Stock that predates lot tracking entirely: a brand-new lot to open, paired
   * with the opening movement that must reference whatever id the store
   * assigns it — the pure function can't know that id, so the caller finishes
   * the pairing (see src/lib/ops/stockLedgerBackfill.ts).
   */
  openings: { lot: Omit<StockLot, 'id' | 'createdAt'>; movement: Omit<NewMovement, 'lotId'> }[]
  /** Movements against already-existing lots, plus unattributed reconciliation — lotId is already final. */
  movements: NewMovement[]
}

/**
 * One 'opening' movement per existing lot (carrying its legacy qtyRemaining),
 * plus whatever it takes to make the derived total match each product's
 * legacy qtyOnHand exactly: a brand-new lot when a product never had one at
 * all (mirrors what the old costingBackfill's buildOpeningLots did), or an
 * unattributed reconciling movement when lots exist but don't quite sum to
 * it (stock a "subtract" adjustment removed beyond what its lots held, before
 * this ledger existed to account for that precisely).
 *
 * Idempotent by construction — re-running it on the same input produces the
 * same result — but not idempotent to *apply* twice (it would double the
 * opening movements). The store-writing half is what makes this a one-time
 * thing, via `ledgerBackfilledAt`.
 */
export function buildLedgerBackfill(products: LegacyProduct[], lots: LegacyStockLot[]): LedgerBackfillResult {
  const openings: LedgerBackfillResult['openings'] = []
  const movements: NewMovement[] = []

  for (const product of products) {
    const legacyQty = product.qtyOnHand ?? 0
    const productLots = lots.filter((l) => l.productId === product.id)

    let sumFromLots = 0
    for (const lot of productLots) {
      const remaining = lot.qtyRemaining ?? 0
      sumFromLots += remaining
      movements.push({
        productId: product.id,
        delta: remaining,
        reason: 'opening',
        lotId: lot.id,
        unitCost: lot.unitCost,
        refType: null,
        refId: null,
        occurredAt: lot.receivedAt,
      })
    }

    const shortfall = legacyQty - sumFromLots
    if (shortfall === 0) continue

    if (productLots.length === 0 && legacyQty > 0) {
      openings.push({
        lot: {
          productId: product.id,
          unitCost: product.costPrice,
          qtyReceived: legacyQty,
          receivedAt: product.createdAt,
          expenseId: null,
        },
        movement: {
          productId: product.id,
          delta: legacyQty,
          reason: 'opening',
          unitCost: product.costPrice,
          refType: null,
          refId: null,
          occurredAt: product.createdAt,
        },
      })
    } else {
      movements.push({
        productId: product.id,
        delta: shortfall,
        reason: 'opening',
        lotId: null,
        unitCost: product.costPrice,
        refType: null,
        refId: null,
        occurredAt: product.createdAt,
      })
    }
  }

  return { openings, movements }
}
