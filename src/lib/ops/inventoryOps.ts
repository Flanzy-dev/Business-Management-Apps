// Cross-store orchestration for inventory stock changes that also represent a
// real cash outflow. Pages call these instead of composing store actions
// themselves, so a stock addition and its expense record can never drift
// apart (e.g. stock bumped but nothing shows in Expenses/P&L, or vice versa).
// The link runs both ways: Inventory-side stock changes stamp a linked
// expense (this file), and Expenses-side "Inventory Purchase" entries can
// stamp a linked stock change (recordExpense) — deleting either reverses the
// stock it caused (deleteExpenseWithStockReversal), the same deduct-once /
// restore-once invariant src/lib/orderLifecycle.ts enforces for Work Orders.
//
// Stores arrive through `deps` (src/lib/ops/deps.ts) rather than being reached
// as singletons, so these operations can be driven by fakes in a test — see
// src/lib/__tests__/inventoryOps.test.ts. Named exports at the bottom keep
// every existing call site working unchanged.
import { Product } from '../../store/inventoryStore'
import { Expense } from '../../store/expenseStore'
import { StockLot } from '../../store/stockLotStore'
import { StockMovement } from '../../store/stockMovementStore'
import { drawFifo } from '../inventoryCosting'
import { hydrateLots, qtyOnHand } from '../stockLedger'
import { realOpsDeps, type OpsDeps } from './deps'

export interface StockPurchase {
  amount: number
  vendor: string
  description: string
}

interface LinkedProductPurchase {
  productId: string
  quantity: number
}

/**
 * Pure: the "Inventory Purchase" expense payload for a stock addition,
 * linked to the product/quantity it represents. Date matches the manual
 * expense form's format (see src/pages/Expenses.tsx) so auto-created rows
 * sort and filter identically to hand-entered ones.
 *
 * Stays outside the factory — it touches no store, and already has tests.
 */
export function buildStockPurchaseExpense(
  productId: string,
  quantity: number,
  purchase: StockPurchase,
  now: Date = new Date()
): Omit<Expense, 'id' | 'createdAt'> {
  return {
    date: now.toISOString().split('T')[0],
    category: 'Inventory Purchase',
    description: purchase.description,
    amount: Math.max(0, Math.round(purchase.amount)),
    vendor: purchase.vendor,
    notes: '',
    productId,
    quantityAffected: quantity,
  }
}

export type InventoryOpsDeps = Pick<
  OpsDeps,
  'inventory' | 'expenses' | 'stockLots' | 'movements' | 'now' | 'mode' | 'deviceId'
>

/**
 * How much of a reversed expense's quantity can come back out of its own lot
 * versus how much is unattributed — pure clamping math pulled out of
 * deleteExpenseWithStockReversal. A lot already sold through can't be
 * un-consumed, so what comes back out of *that* lot clamps at what's left in
 * it (`lot` is undefined for an expense whose lot has since been deleted
 * entirely, not just drawn down).
 */
function reversalSplit(lot: StockLot | undefined, qty: number, movements: StockMovement[]): { fromLot: number; unattributed: number } {
  const lotRemaining = lot ? hydrateLots([lot], movements)[0]?.qtyRemaining ?? 0 : 0
  const fromLot = lot ? Math.min(qty, Math.max(0, lotRemaining)) : 0
  return { fromLot, unattributed: qty - fromLot }
}

export function createInventoryOps(deps: InventoryOpsDeps) {
  /**
   * Open a FIFO lot for stock arriving now, and record the ledger movement that
   * makes it count toward stock on hand. Unit cost comes from what was actually
   * paid; a stock addition with no purchase recorded falls back to the
   * product's current cost price so the lot is never valued at zero.
   */
  function openLot(
    productId: string,
    qty: number,
    purchase: StockPurchase | null,
    expenseId: string | null
  ): void {
    if (qty <= 0) return
    const unitCost = purchase
      ? Math.round(purchase.amount / qty)
      : deps.inventory.getState().getProduct(productId)?.costPrice ?? 0
    const receivedAt = deps.now().toISOString()
    const lot = deps.stockLots.getState().addLot({
      productId,
      unitCost,
      qtyReceived: qty,
      receivedAt,
      expenseId,
    })
    deps.movements.getState().addMovement({
      productId,
      delta: qty,
      reason: purchase ? 'purchase' : 'received',
      lotId: lot.id,
      unitCost,
      refType: expenseId ? 'expense' : null,
      refId: expenseId,
      occurredAt: receivedAt,
      deviceId: deps.deviceId(),
      mode: deps.mode(),
    })
  }

  /** Draw stock out of its lots, oldest first — for removals that aren't a sale (waste, shrinkage). */
  function drainLots(productId: string, qty: number): void {
    const lotStore = deps.stockLots.getState()
    const movementStore = deps.movements.getState()
    const lots = hydrateLots(lotStore.getLotsByProduct(productId), movementStore.movements)
    const draw = drawFifo(lots, qty)
    const occurredAt = deps.now().toISOString()
    for (const c of draw.consumptions) {
      movementStore.addMovement({
        productId,
        delta: -c.quantity,
        reason: 'adjustment',
        lotId: c.lotId,
        unitCost: c.unitCost,
        refType: 'manual',
        refId: null,
        occurredAt,
        deviceId: deps.deviceId(),
        mode: deps.mode(),
      })
    }
    // Beyond what any lot could cover — still a real removal, so the ledger
    // accounts for the full quantity requested instead of silently under-
    // draining, priced at the product's current cost like a sale's shortfall.
    if (draw.shortfallQty > 0) {
      const fallbackCostPrice = deps.inventory.getState().getProduct(productId)?.costPrice ?? 0
      movementStore.addMovement({
        productId,
        delta: -draw.shortfallQty,
        reason: 'adjustment',
        lotId: null,
        unitCost: fallbackCostPrice,
        refType: 'manual',
        refId: null,
        occurredAt,
        deviceId: deps.deviceId(),
        mode: deps.mode(),
      })
    }
  }

  /**
   * Record a stock change and, when `purchase` is given, its matching linked
   * expense. `qty` may be negative (a "subtract" adjustment never carries a
   * purchase — removing stock isn't a purchase — callers should pass
   * `purchase: null`), in which case the removed quantity is drawn out of the
   * oldest lots so the remaining value stays honest.
   */
  function restockProduct(productId: string, qty: number, purchase: StockPurchase | null): void {
    if (qty > 0) {
      const expense = purchase
        ? deps.expenses
            .getState()
            .addExpense(buildStockPurchaseExpense(productId, qty, purchase, deps.now()))
        : null
      openLot(productId, qty, purchase, expense?.id ?? null)
    } else if (qty < 0) {
      drainLots(productId, -qty)
    }
  }

  /**
   * Create a product and, when `purchase` is given, record its linked
   * opening-stock expense. Editing an existing product never goes through
   * here — only a brand-new product's initial quantity is a purchase.
   * `initialQty` is separate from `data` because quantity on hand isn't a
   * stored Product field any more (see src/store/inventoryStore.ts) — it opens
   * this product's first lot instead.
   */
  function createProduct(
    data: Omit<Product, 'id' | 'createdAt'>,
    initialQty: number,
    purchase: StockPurchase | null
  ): Product {
    const product = deps.inventory.getState().addProduct(data)
    if (initialQty > 0) {
      const expense = purchase
        ? deps.expenses
            .getState()
            .addExpense(buildStockPurchaseExpense(product.id, initialQty, purchase, deps.now()))
        : null
      openLot(product.id, initialQty, purchase, expense?.id ?? null)
    }
    return product
  }

  /**
   * Record any expense (any category); when `linked` is given, also adds that
   * quantity to the product's stock. This is the Expenses-page entry point —
   * the mirror of restockProduct/createProduct, which start from Inventory.
   */
  function recordExpense(
    data: Omit<Expense, 'id' | 'createdAt' | 'productId' | 'quantityAffected'>,
    linked: LinkedProductPurchase | null
  ): Expense {
    const expense = deps.expenses.getState().addExpense({
      ...data,
      productId: linked?.productId ?? null,
      quantityAffected: linked?.quantity ?? null,
    })
    if (linked) {
      openLot(
        linked.productId,
        linked.quantity,
        { amount: data.amount, vendor: data.vendor, description: data.description },
        expense.id
      )
    }
    return expense
  }

  /**
   * Delete an expense; if it added stock for a product, reverse that stock.
   * A lot already sold through can't be un-consumed, so what comes back out of
   * *that* lot clamps at what's left in it; the rest of the reversal (stock
   * that was already sold before this expense got deleted) still brings the
   * product-level total down by the full quantity, just without attributing it
   * to any one lot. Safe no-op for any expense that was never linked.
   */
  function deleteExpenseWithStockReversal(expenseId: string): void {
    const expenseStore = deps.expenses.getState()
    const expense = expenseStore.getExpense(expenseId)
    if (!expense?.productId || !expense.quantityAffected) {
      expenseStore.deleteExpense(expenseId)
      return
    }

    const productId = expense.productId
    const qty = expense.quantityAffected
    const lotStore = deps.stockLots.getState()
    const movementStore = deps.movements.getState()
    const lot = lotStore.stockLots.find((l) => l.expenseId === expenseId)
    const occurredAt = deps.now().toISOString()

    const { fromLot, unattributed } = reversalSplit(lot, qty, movementStore.movements)
    const fallbackUnitCost = lot?.unitCost ?? deps.inventory.getState().getProduct(productId)?.costPrice ?? 0

    if (lot && fromLot > 0) {
      movementStore.addMovement({
        productId,
        delta: -fromLot,
        reason: 'purchase-reversal',
        lotId: lot.id,
        unitCost: lot.unitCost,
        refType: 'expense',
        refId: expenseId,
        occurredAt,
        deviceId: deps.deviceId(),
        mode: deps.mode(),
      })
    }
    if (unattributed > 0) {
      movementStore.addMovement({
        productId,
        delta: -unattributed,
        reason: 'purchase-reversal',
        lotId: null,
        unitCost: fallbackUnitCost,
        refType: 'expense',
        refId: expenseId,
        occurredAt,
        deviceId: deps.deviceId(),
        mode: deps.mode(),
      })
    }

    expenseStore.deleteExpense(expenseId)
  }

  /**
   * Correct a product's derived stock to a freshly counted quantity — the
   * Inventory page's "Reconcile stock" action, for a product the stock ledger
   * flagged negative (src/lib/stockLedger.ts's negativeStockProducts) — usually
   * a sale recorded against stock that was never booked in.
   * Appends a single unattributed 'adjustment' movement for the difference —
   * never edits or removes a past movement, so the sales that caused the
   * oversell stay in the ledger as the honest record of what happened.
   */
  function reconcileStock(productId: string, countedQty: number): void {
    const movementStore = deps.movements.getState()
    const delta = countedQty - qtyOnHand(movementStore.movements, productId)
    if (delta === 0) return
    movementStore.addMovement({
      productId,
      delta,
      reason: 'adjustment',
      lotId: null,
      unitCost: deps.inventory.getState().getProduct(productId)?.costPrice ?? 0,
      refType: 'manual',
      refId: null,
      occurredAt: deps.now().toISOString(),
      deviceId: deps.deviceId(),
      mode: deps.mode(),
    })
  }

  return {
    restockProduct,
    createProduct,
    recordExpense,
    deleteExpenseWithStockReversal,
    reconcileStock,
  }
}

// The one real instance the running app uses. Every named export below is a
// thin pass-through onto it, so no page or dialog import had to change.
const defaultOps = createInventoryOps(realOpsDeps)

export const restockProduct = defaultOps.restockProduct
export const createProduct = defaultOps.createProduct
export const recordExpense = defaultOps.recordExpense
export const deleteExpenseWithStockReversal = defaultOps.deleteExpenseWithStockReversal
export const reconcileStock = defaultOps.reconcileStock
