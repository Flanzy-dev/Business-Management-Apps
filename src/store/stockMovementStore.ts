import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { newEntity } from './entityHelpers'
import { getStorageAdapter } from '../lib/storageAdapter'

/**
 * One append-only entry in the stock ledger. Every change to how much of a
 * product the shop holds — a sale, a purchase, an order deleted, a shelf
 * recount — is one row here, never a mutation of a stored counter. That is
 * what makes stock safe to hold on more than one device at once: two offline
 * sales of the same product are two movements, and both survive being merged
 * back together, where two writes to one `qtyOnHand` field would have the
 * second silently overwrite the first.
 *
 * Movements are never edited or deleted. A reversal (an order deleted, an
 * expense removed) is a new movement with the opposite sign — see
 * src/lib/ops/orderOps.ts and src/lib/ops/inventoryOps.ts. Current stock is
 * always Σ delta, computed in src/lib/stockLedger.ts — never read from here
 * directly.
 */
export interface StockMovement {
  id: string
  productId: string
  /** Positive: stock arrived. Negative: stock left. Never clamped or zeroed — a
   *  negative running total means the shop oversold, and that must be visible,
   *  not hidden by clamping it away (see stockLedger.ts). */
  delta: number
  reason: 'opening' | 'purchase' | 'received' | 'sale' | 'sale-reversal' | 'purchase-reversal' | 'adjustment'
  /** The FIFO lot this movement opened or drew from; null for the slice of a
   *  draw no lot could cover (src/lib/inventoryCosting.ts's shortfallQty) or
   *  for a reconciling adjustment not attributed to any one batch. */
  lotId: string | null
  /** Whole Rupiah, frozen at the moment of this movement — never recomputed later. */
  unitCost: number
  refType: 'workOrder' | 'expense' | 'manual' | null
  refId: string | null
  /** FIFO/report ordering key — mirrors StockLot.receivedAt, not wall-clock createdAt. */
  occurredAt: string
  deviceId: string
  /** Admin/Worker mode active when this was recorded — audit attribution for
   *  Settings' Activity Log card (src/lib/stockLedger.ts's manualStockChanges
   *  picks which reasons are worth showing there). Optional because this
   *  store isn't versioned/migrated: rows written before this field existed
   *  simply don't have it, same convention as Vehicle.isDefault. Undefined
   *  means "unknown", never rendered as if it were admin. */
  mode?: 'admin' | 'worker'
  createdAt: string
}

interface StockMovementStore {
  movements: StockMovement[]
  /** Set once the one-time move from stored qtyOnHand/qtyRemaining to this
   *  ledger has run — see src/lib/ops/stockLedgerBackfill.ts. */
  ledgerBackfilledAt: string | null
  /**
   * `deviceId` and `mode` are supplied by the caller (the ops layer, via
   * OpsDeps.deviceId()/OpsDeps.mode() — see src/lib/ops/deps.ts) rather than
   * stamped in here. This store used to read them itself by importing
   * getDeviceId/currentMode directly — the one place a persisted domain store
   * reached into live session state — which is also why authStore's own
   * module-load read had to guard itself for a DOM-less test environment.
   * Attribution is part of the record an op writes, same as `occurredAt`, so a
   * test should be able to pin it the same way.
   */
  addMovement: (data: Omit<StockMovement, 'id' | 'createdAt'>) => StockMovement
  markLedgerBackfilled: (at: string) => void
}

export const useStockMovementStore = create<StockMovementStore>()(
  persist(
    (set) => ({
      movements: [],
      ledgerBackfilledAt: null,

      addMovement: (data) => {
        const movement = newEntity(data)
        set((state) => ({ movements: [...state.movements, movement] }))
        return movement
      },

      markLedgerBackfilled: (at) => set({ ledgerBackfilledAt: at }),
    }),
    { name: 'stock-movement-store', storage: createJSONStorage(getStorageAdapter) }
  )
)
