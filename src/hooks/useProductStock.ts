import { useMemo } from 'react'
import { useInventoryStore } from '../store/inventoryStore'
import { useStockMovementStore } from '../store/stockMovementStore'
import { withStock, ProductWithStock } from '../lib/stockLedger'

/**
 * Every product enriched with its derived qtyOnHand (src/lib/stockLedger.ts) —
 * the read path every page/component uses in place of the old stored
 * `Product.qtyOnHand`. Re-renders whenever the product list or the stock
 * ledger changes.
 */
export function useProductStock(): ProductWithStock[] {
  const products = useInventoryStore((s) => s.products)
  const movements = useStockMovementStore((s) => s.movements)
  return useMemo(() => withStock(products, movements), [products, movements])
}

