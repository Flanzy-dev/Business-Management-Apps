// Store-writing half of the one-time move from stored quantity counters to
// the stock ledger. Runs once per install, from App.tsx on mount, after
// runCostingBackfill — the pure decisions live in src/lib/stockLedgerBackfill.ts.
//
// Stores arrive through `deps`, same createXOps(deps) + bound-default shape
// every other ops file uses — see src/lib/ops/costingBackfill.ts's header for
// why that matters for a migration that runs once against real user data.
import { realOpsDeps, type OpsDeps } from './deps'
import { buildLedgerBackfill, LegacyProduct, LegacyStockLot } from '../stockLedgerBackfill'

export type StockLedgerBackfillOpsDeps = Pick<
  OpsDeps,
  'inventory' | 'stockLots' | 'movements' | 'mode' | 'deviceId'
>

export function createStockLedgerBackfillOps(deps: StockLedgerBackfillOpsDeps) {
  /**
   * Give the stock ledger a starting point matching whatever the old stored
   * counters said, so derived quantities don't jump the moment this ships.
   * No-op once `ledgerBackfilledAt` is set — on a brand-new install (nothing
   * persisted yet) this still runs, harmlessly produces nothing to write, and
   * stamps the marker so it's never reconsidered.
   */
  function runStockLedgerBackfill(): void {
    const movementStore = deps.movements.getState()
    if (movementStore.ledgerBackfilledAt) return

    const lotStore = deps.stockLots.getState()
    // Read loosely: these fields no longer exist on the current Product/StockLot
    // types (see src/lib/stockLedgerBackfill.ts's header), but may still be
    // sitting in already-persisted JSON from before this migration.
    const products = deps.inventory.getState().products as unknown as LegacyProduct[]
    const lots = lotStore.stockLots as unknown as LegacyStockLot[]

    const { openings, movements } = buildLedgerBackfill(products, lots)

    for (const { lot, movement } of openings) {
      const newLot = lotStore.addLot(lot)
      movementStore.addMovement({ ...movement, lotId: newLot.id, deviceId: deps.deviceId(), mode: deps.mode() })
    }
    for (const m of movements) movementStore.addMovement({ ...m, deviceId: deps.deviceId(), mode: deps.mode() })

    movementStore.markLedgerBackfilled(new Date().toISOString())
  }

  return { runStockLedgerBackfill }
}

// The one real instance the running app uses.
const defaultOps = createStockLedgerBackfillOps(realOpsDeps)

export const runStockLedgerBackfill = defaultOps.runStockLedgerBackfill
