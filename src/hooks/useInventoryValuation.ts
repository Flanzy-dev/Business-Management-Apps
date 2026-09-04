import { useMemo } from 'react'
import { useStockLotStore } from '../store/stockLotStore'
import { useStockMovementStore } from '../store/stockMovementStore'
import { hydrateLots, ProductWithStock } from '../lib/stockLedger'
import { lotValueByProduct, groupLotsByProduct, averageUnitCost } from '../lib/inventoryCosting'

export interface InventoryValuation {
  /** Σ qtyRemaining × unitCost per product — what stock on hand is worth. */
  valueByProductId: Map<string, number>
  /** Weighted average unit cost of what's left, falling back to the
   *  product's own cost price when no lot is behind its stock. */
  unitCostOf(product: ProductWithStock): number
}

/**
 * The read model Reports.tsx, Inventory.tsx and Settings.tsx each rebuilt
 * separately — one hydrateLots pass over the ledger, grouped once, instead
 * of every call site pairing lotValueByProduct(hydrateLots(...)) or (worse)
 * calling lotsByProduct + averageUnitCost per product inside a sort/render
 * loop. Sibling to src/hooks/useProductStock.ts, which this composes with:
 * that hook derives qtyOnHand from the same ledger, this one derives value.
 */
export function useInventoryValuation(): InventoryValuation {
  const stockLots = useStockLotStore((s) => s.stockLots)
  const movements = useStockMovementStore((s) => s.movements)

  return useMemo(() => {
    const lots = hydrateLots(stockLots, movements)
    const valueByProductId = lotValueByProduct(lots)
    const lotsByProductId = groupLotsByProduct(lots)

    return {
      valueByProductId,
      unitCostOf: (product: ProductWithStock) => averageUnitCost(lotsByProductId.get(product.id) ?? []) ?? product.costPrice,
    }
  }, [stockLots, movements])
}
