// Store-writing half of the one-time move from stored quantity counters to
// the stock ledger. Runs once per install, from App.tsx on mount, after
// runCostingBackfill — the pure decisions live in src/lib/stockLedgerBackfill.ts.
import { useInventoryStore } from '../../store/inventoryStore'
import { useStockLotStore } from '../../store/stockLotStore'
import { useStockMovementStore } from '../../store/stockMovementStore'
import { buildLedgerBackfill, LegacyProduct, LegacyStockLot } from '../stockLedgerBackfill'

/**
 * Give the stock ledger a starting point matching whatever the old stored
 * counters said, so derived quantities don't jump the moment this ships.
 * No-op once `ledgerBackfilledAt` is set — on a brand-new install (nothing
 * persisted yet) this still runs, harmlessly produces nothing to write, and
 * stamps the marker so it's never reconsidered.
 */
export function runStockLedgerBackfill(): void {
  const movementStore = useStockMovementStore.getState()
  if (movementStore.ledgerBackfilledAt) return

  const lotStore = useStockLotStore.getState()
  // Read loosely: these fields no longer exist on the current Product/StockLot
  // types (see src/lib/stockLedgerBackfill.ts's header), but may still be
  // sitting in already-persisted JSON from before this migration.
  const products = useInventoryStore.getState().products as unknown as LegacyProduct[]
  const lots = lotStore.stockLots as unknown as LegacyStockLot[]

  const { openings, movements } = buildLedgerBackfill(products, lots)

  for (const { lot, movement } of openings) {
    const newLot = lotStore.addLot(lot)
    movementStore.addMovement({ ...movement, lotId: newLot.id })
  }
  for (const m of movements) movementStore.addMovement(m)

  movementStore.markLedgerBackfilled(new Date().toISOString())
}
