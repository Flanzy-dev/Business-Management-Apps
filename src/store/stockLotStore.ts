import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { newEntity } from './entityHelpers'
import { getStorageAdapter } from '../lib/storageAdapter'

/**
 * One batch of stock as it was actually bought. Inventory is costed FIFO —
 * oldest lot first — so oil bought at 40.000 and oil bought later at 55.000
 * stay distinguishable instead of collapsing into one `Product.costPrice`.
 * A sale's share of these costs is frozen onto the work-order line when the
 * order completes (see WorkOrderItem.costOfGoods), so a report never moves
 * after the fact.
 *
 * A lot row is permanent history once created — it is never edited or
 * deleted. How much of it remains is not stored here; it's derived from the
 * stock ledger (src/store/stockMovementStore.ts, src/lib/stockLedger.ts) by
 * summing every movement that references this lot's id. That is what lets
 * two devices draw from the same lot offline without one overwriting the
 * other's draw — see CLAUDE.md's inventory-costing note.
 */
export interface StockLot {
  id: string
  productId: string
  unitCost: number // whole Rupiah, as paid for this batch
  qtyReceived: number // immutable — what this batch actually held when it arrived
  // The FIFO sort key, deliberately separate from createdAt: stock restored by
  // deleting a completed order re-enters at the date it was consumed, so it
  // lands back in its old queue position rather than at the end.
  receivedAt: string
  expenseId: string | null // the Inventory Purchase that paid for it, for reversal
  createdAt: string
}

interface StockLotStore {
  stockLots: StockLot[]
  /** Set once the one-time FIFO backfill has run — see src/lib/ops/costingBackfill.ts. */
  backfilledAt: string | null
  addLot: (data: Omit<StockLot, 'id' | 'createdAt'>) => StockLot
  /** All lot rows for a product, oldest first — the order stockLedger's
   *  hydration expects. Carries no remaining-quantity info; pair with
   *  src/lib/stockLedger.ts's hydrateLots to get live balances. */
  getLotsByProduct: (productId: string) => StockLot[]
  markBackfilled: (at: string) => void
}

export const useStockLotStore = create<StockLotStore>()(
  persist(
    (set, get) => ({
      stockLots: [],
      backfilledAt: null,

      addLot: (data) => {
        const lot = newEntity(data)
        set((state) => ({ stockLots: [...state.stockLots, lot] }))
        return lot
      },

      getLotsByProduct: (productId) => {
        return get()
          .stockLots.filter((lot) => lot.productId === productId)
          .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt))
      },

      markBackfilled: (at) => set({ backfilledAt: at }),
    }),
    { name: 'stock-lot-store', storage: createJSONStorage(getStorageAdapter) }
  )
)
