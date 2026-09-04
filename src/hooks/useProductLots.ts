import { useMemo } from 'react'
import { useStockLotStore, StockLot } from '../store/stockLotStore'
import { useStockMovementStore } from '../store/stockMovementStore'
import { lotsByProduct } from '../lib/stockLedger'
import { averageUnitCost, LotBalance } from '../lib/inventoryCosting'

/**
 * One product's FIFO lot history, live — the read path three inventory
 * dialogs (AdjustStockDialog, DuplicateProductDialog, PriceHistoryDialog) each
 * used to assemble by hand from the same two store subscriptions. Same
 * `useMemo` discipline as `useProductStock.ts`.
 */
export function useProductLots(productId: string): {
  /** Hydrated balances (oldest first) — what drawFifo/costing code expects. */
  lots: LotBalance[]
  /** Blended cost of what's currently on hand, or null with nothing left. */
  averageCost: number | null
  /** The raw, immutable lot rows for this product — qtyReceived/receivedAt
   *  history that hydration doesn't carry (PriceHistoryDialog's own need). */
  rawLots: StockLot[]
} {
  const stockLots = useStockLotStore((s) => s.stockLots)
  const movements = useStockMovementStore((s) => s.movements)

  return useMemo(() => {
    const lots = lotsByProduct(stockLots, movements, productId)
    return {
      lots,
      averageCost: averageUnitCost(lots),
      rawLots: stockLots.filter((lot) => lot.productId === productId),
    }
  }, [stockLots, movements, productId])
}
