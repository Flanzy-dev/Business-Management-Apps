// Cross-store orchestration for the work-order lifecycle. Pages call these
// instead of composing store actions themselves, so the status change and its
// inventory side effect can never be applied separately.
//
// Stores arrive through `deps` (src/lib/ops/deps.ts). The schedule side effect
// runs through an inline createScheduleOps built from those same deps, so a
// test driving completeOrder with fakes sees the schedule move too rather than
// silently hitting the live singletons. Named exports at the bottom keep every
// call site unchanged.
import { WorkOrder, WorkOrderItem } from '../../store/workOrderStore'
import { Vehicle } from '../../store/vehicleStore'
import { StockMovement } from '../../store/stockMovementStore'
import { drawFifo, LotBalance } from '../inventoryCosting'
import { hydrateLots, qtyOnHand } from '../stockLedger'
import { applyCompletion, applyPayment, applyVoid, firstInsufficientStockProduct, type StockAdjustment } from '../orderLifecycle'
import { buildServiceEventFromOrder } from '../serviceEventLifecycle'
import { bayHoldingOrder, estimatedEnd } from '../bayAssignment'
import { createScheduleOps, type ScheduleOpsDeps } from './scheduleOps'
import { realOpsDeps, type OpsDeps } from './deps'
import { translate } from '../i18n'

type CompleteOrderResult =
  | { ok: true; order: WorkOrder }
  | { ok: false; reason: string }

export type OrderOpsDeps = Pick<
  OpsDeps,
  | 'workOrders'
  | 'inventory'
  | 'vehicles'
  | 'serviceEvents'
  | 'stockLots'
  | 'movements'
  | 'mode'
  | 'deviceId'
  | 'bays'
  | 'reminderFollowUps'
> &
  ScheduleOpsDeps

export function createOrderOps(deps: OrderOpsDeps) {
  const { applyChangedServiceToSchedule, unwindScheduleForOrder } = createScheduleOps(deps)

  /**
   * Claim a bay for this order — releasing whatever bay held it before (a
   * re-assignment to a different bay), so an order never occupies two bays
   * at once. Bay occupancy is otherwise entirely derived from the order
   * lifecycle: completeOrder/voidOrder/deleteOrder all release it below,
   * which is what keeps a bay from being left "in service" forever once its
   * order is done.
   */
  function assignOrderToBay(orderId: string, bayId: string, workerId: string | null, estimatedMinutes: number): void {
    const bayStore = deps.bays.getState()
    const previous = bayHoldingOrder(bayStore.bays, orderId)
    if (previous && previous.id !== bayId) bayStore.clearBay(previous.id)
    bayStore.assignWorkOrder(bayId, orderId, workerId, estimatedEnd(deps.now(), estimatedMinutes))
  }

  /** Release whatever bay holds this order, if any. Safe no-op when the
   *  order was never assigned a bay. */
  function releaseOrderBay(orderId: string): void {
    const bayStore = deps.bays.getState()
    const bay = bayHoldingOrder(bayStore.bays, orderId)
    if (bay) bayStore.clearBay(bay.id)
  }

  /** Defense-in-depth: the reason completion must be refused, or null when
   *  every product-linked line's merged demand fits current stock. Checked
   *  before any mutation so a rejected completion leaves order status and
   *  stock untouched. */
  function insufficientStockReason(stockAdjustments: StockAdjustment[], movements: StockMovement[]): string | null {
    const insufficientProductId = firstInsufficientStockProduct(stockAdjustments, (productId) => qtyOnHand(movements, productId))
    if (!insufficientProductId) return null
    const productName = deps.inventory.getState().getProduct(insufficientProductId)?.name ?? translate('workOrders.genericItemLabel')
    return translate('workOrders.orderInsufficientStockError', { product: productName })
  }

  /**
   * Draw every product-linked line out of its FIFO lots and freeze what it
   * actually cost onto the line — the moment the parts leave the shelf, so
   * editing a product's cost price later can never move this order's P&L.
   * `movements` must be the same snapshot the caller already checked
   * insufficientStockReason against, not re-read here — the working-lot map
   * below is scoped to this one call so two lines of the same product can't
   * both draw from the same opening lots.
   */
  function drawStockForOrder(
    order: WorkOrder,
    movements: StockMovement[],
    occurredAt: string
  ): { costedItems: WorkOrderItem[]; movementsToAdd: Omit<StockMovement, 'id' | 'createdAt'>[] } {
    const inventoryStore = deps.inventory.getState()
    const lotStore = deps.stockLots.getState()
    // One movement per FIFO draw (plus one for whatever no lot could cover) —
    // together they always sum to exactly this line's quantity, so the ledger
    // needs no separate "adjust stock" step the way the old stored counter did.
    const movementsToAdd: Omit<StockMovement, 'id' | 'createdAt'>[] = []
    const workingLots = new Map<string, LotBalance[]>()
    const costedItems = order.items.map(item => {
      if (!item.productId) return item
      const productId = item.productId
      if (!workingLots.has(productId)) {
        workingLots.set(productId, hydrateLots(lotStore.getLotsByProduct(productId), movements))
      }
      const lots = workingLots.get(productId)!
      const draw = drawFifo(lots, item.quantity)
      for (const c of draw.consumptions) {
        const lot = lots.find(l => l.id === c.lotId)
        if (lot) lot.qtyRemaining -= c.quantity
        movementsToAdd.push({
          productId,
          delta: -c.quantity,
          reason: 'sale',
          lotId: c.lotId,
          unitCost: c.unitCost,
          refType: 'workOrder',
          refId: order.id,
          occurredAt,
          deviceId: deps.deviceId(),
          mode: deps.mode(),
        })
      }
      // Stock with no lot behind it (rows predating lot costing, or an addition
      // with no purchase recorded) is priced at the product's current cost
      // rather than costed at zero — and still gets its own movement so the
      // ledger accounts for the full quantity sold, not just the lot-covered part.
      const fallbackCostPrice = inventoryStore.getProduct(productId)?.costPrice ?? 0
      if (draw.shortfallQty > 0) {
        movementsToAdd.push({
          productId,
          delta: -draw.shortfallQty,
          reason: 'sale',
          lotId: null,
          unitCost: fallbackCostPrice,
          refType: 'workOrder',
          refId: order.id,
          occurredAt,
          deviceId: deps.deviceId(),
          mode: deps.mode(),
        })
      }
      const fallbackCost = Math.round(draw.shortfallQty * fallbackCostPrice)
      return { ...item, costOfGoods: draw.cost + fallbackCost }
    })
    return { costedItems, movementsToAdd }
  }

  /** The odometer reading this completion happened at — the service reading
   *  wins, then arrival, then the vehicle's own last-known mileage. Falls
   *  back that far so a "changed" service completed with no odometer typed
   *  in never moves the schedule's base to null and leaves the vehicle
   *  reading overdue immediately after being serviced. */
  function resolveServiceOdometer(order: WorkOrder, vehicle: Vehicle | undefined): number | null {
    return order.odometerAtService ?? order.odometerAtArrival ?? vehicle?.currentMileage ?? null
  }

  /** Move the schedule base for every tagged line marked "changed" — a
   *  top-up never touches the schedule. Only called once a ServiceEvent
   *  actually exists for this order (see completeOrder). */
  function applyScheduleMovesForOrder(order: WorkOrder, currentOdometer: number | null): void {
    const completionDate = (order.completedAt ?? order.createdAt).slice(0, 10)
    for (const item of order.items) {
      if (item.serviceItemTypeId && item.serviceAction === 'changed') {
        applyChangedServiceToSchedule(order.vehicleId, item.serviceItemTypeId, order.id, {
          newBaseOdometer: currentOdometer,
          newBaseDate: completionDate,
          requestedIntervalKm: item.requestedIntervalKm ?? null,
        })
      }
    }
  }

  /** Raise the vehicle's currentMileage to this reading, if it's actually
   *  higher — outside the service-event branch on purpose: an odometer
   *  reading is a fact about the car, not about the servicing. A visit that
   *  only sold a wiper blade still saw the real number, and leaving it
   *  unrecorded is what makes the next visit's due badges and suggestions
   *  wrong. */
  function writeBackOdometer(vehicleId: string, currentOdometer: number | null): void {
    if (currentOdometer == null) return
    const vehicleStore = deps.vehicles.getState()
    const vehicle = vehicleStore.getVehicle(vehicleId)
    if (vehicle && currentOdometer > (vehicle.currentMileage ?? 0)) {
      vehicleStore.updateVehicle(vehicle.id, { currentMileage: currentOdometer })
    }
  }

  /**
   * Complete an order: flip status, stamp payment, deduct linked stock, and —
   * if any line was tagged as a service item — record a ServiceEvent and move
   * the schedule base for any tagged line marked "changed". A top-up never
   * touches the schedule.
   */
  function completeOrder(
    orderId: string,
    paymentMethod: WorkOrder['paymentMethod'],
    amountReceived?: number | null,
    paymentDueDate?: string | null
  ): CompleteOrderResult {
    const workOrderStore = deps.workOrders.getState()
    const order = workOrderStore.getWorkOrder(orderId)
    if (!order) return { ok: false, reason: translate('workOrders.orderNotFoundError') }

    const result = applyCompletion(order, paymentMethod, paymentDueDate ?? null, deps.now())
    if (!result.ok) return result

    // Snapshot taken once, before any mutation — passed down rather than
    // re-read, so a rejected completion is checked against exactly the state
    // it will (or won't) change.
    const movements = deps.movements.getState().movements
    const stockReason = insufficientStockReason(result.stockAdjustments, movements)
    if (stockReason) return { ok: false, reason: stockReason }

    // Cost the sale before anything is written — see drawStockForOrder.
    const occurredAt = result.order.completedAt ?? result.order.createdAt
    const { costedItems, movementsToAdd } = drawStockForOrder(result.order, movements, occurredAt)
    const costedOrder = { ...result.order, items: costedItems, amountReceived: amountReceived ?? null }

    workOrderStore.updateWorkOrder(orderId, costedOrder)
    const movementStore = deps.movements.getState()
    for (const m of movementsToAdd) movementStore.addMovement(m)

    const vehicleForOdometer = deps.vehicles.getState().getVehicle(costedOrder.vehicleId)
    const currentOdometer = resolveServiceOdometer(costedOrder, vehicleForOdometer)

    const serviceEvent = buildServiceEventFromOrder(costedOrder)
    if (serviceEvent) {
      deps.serviceEvents.getState().addServiceEvent(serviceEvent)
      applyScheduleMovesForOrder(costedOrder, currentOdometer)

      // The vehicle just had real work done — any "contacted about being
      // overdue"/snooze note (src/store/reminderFollowUpStore.ts) is about
      // this due cycle specifically and no longer applies, whether or not
      // this particular visit was what advanced the schedule. It reads fresh
      // the next time the vehicle comes due again. Void/delete deliberately
      // don't touch this, same as they don't reverse the odometer write-back.
      deps.reminderFollowUps.getState().clear(costedOrder.vehicleId)
    }

    writeBackOdometer(costedOrder.vehicleId, currentOdometer)

    // The vehicle is done and leaving — whatever bay held this order is free
    // again. This is what keeps bay occupancy derived from the order
    // lifecycle instead of a parallel truth someone has to remember to clear.
    releaseOrderBay(orderId)

    return { ok: true, order: costedOrder }
  }

  /**
   * Collect a completed order's outstanding debt. Pure delegation to
   * applyPayment — no stock/lot/movement/schedule effect, since the sale
   * already completed and the parts already left the shelf.
   */
  function recordPayment(
    orderId: string,
    method: WorkOrder['paymentMethod'],
    amountReceived: number | null
  ): { ok: true; order: WorkOrder } | { ok: false; reason: string } {
    const workOrderStore = deps.workOrders.getState()
    const order = workOrderStore.getWorkOrder(orderId)
    if (!order) return { ok: false, reason: translate('workOrders.orderNotFoundError') }

    const result = applyPayment(order, method, amountReceived, deps.now())
    if (!result.ok) return result

    workOrderStore.updateWorkOrder(orderId, result.order)
    return { ok: true, order: result.order }
  }

  /** Reopen one lot per product line at its frozen cost, dated when the order
   *  consumed it, plus a 'sale-reversal' movement — shared by deleteOrder and
   *  voidOrder. Lots are permanent history, never resurrected: this is a new
   *  lot re-entering the FIFO queue at the point it left, not behind
   *  everything bought since. One movement fully accounts for the quantity, so
   *  no separate "restore stock" step is needed. */
  function restoreCompletedOrderStock(order: WorkOrder): void {
    const lotStore = deps.stockLots.getState()
    const movementStore = deps.movements.getState()
    const receivedAt = order.completedAt ?? order.createdAt
    for (const item of order.items) {
      if (!item.productId || item.quantity <= 0) continue
      const unitCost =
        item.costOfGoods != null
          ? Math.round(item.costOfGoods / item.quantity)
          : deps.inventory.getState().getProduct(item.productId)?.costPrice ?? 0
      const lot = lotStore.addLot({
        productId: item.productId,
        unitCost,
        qtyReceived: item.quantity,
        receivedAt,
        expenseId: null,
      })
      movementStore.addMovement({
        productId: item.productId,
        delta: item.quantity,
        reason: 'sale-reversal',
        lotId: lot.id,
        unitCost,
        refType: 'workOrder',
        refId: order.id,
        occurredAt: receivedAt,
        deviceId: deps.deviceId(),
        mode: deps.mode(),
      })
    }
  }

  /**
   * Delete an order; a completed order's consumed stock is put back first, and
   * any schedule move its "changed" services caused is unwound (see
   * unwindScheduleForOrder) — a deleted order should leave no trace, including
   * on the vehicle's next-due. The odometer write-back is the one exception:
   * a reading is a fact about the car, not about the sale, there's no stored
   * prior value to restore it to, and a mis-typed one is corrected by editing
   * the vehicle directly.
   */
  function deleteOrder(orderId: string): void {
    const workOrderStore = deps.workOrders.getState()
    const order = workOrderStore.getWorkOrder(orderId)
    if (!order) return
    if (order.status === 'completed') restoreCompletedOrderStock(order)
    deps.serviceEvents.getState().deleteServiceEventsByWorkOrder(orderId)
    unwindScheduleForOrder(orderId)
    workOrderStore.deleteWorkOrder(orderId)
    releaseOrderBay(orderId)
  }

  /**
   * Void a completed order: put its stock back, unwind any schedule move it
   * caused (same as deleteOrder — see unwindScheduleForOrder), and keep the
   * row (status 'cancelled') with a reason, so the sale stays in history
   * instead of vanishing the way deleteOrder makes it. The odometer
   * write-back is still not reversed, for the same reason deleteOrder leaves
   * it: no prior value is stored to restore, and a mis-typed reading is fixed
   * on the vehicle itself.
   */
  function voidOrder(orderId: string, reason: string): { ok: boolean; reason?: string } {
    const workOrderStore = deps.workOrders.getState()
    const order = workOrderStore.getWorkOrder(orderId)
    if (!order) return { ok: false, reason: translate('workOrders.orderNotFoundError') }
    const decision = applyVoid(order, reason, deps.now())
    if (!decision.ok) return { ok: false, reason: decision.reason }
    restoreCompletedOrderStock(order)
    deps.serviceEvents.getState().deleteServiceEventsByWorkOrder(orderId)
    unwindScheduleForOrder(orderId)
    workOrderStore.updateWorkOrder(orderId, {
      status: 'cancelled',
      voidedAt: decision.order.voidedAt,
      voidReason: decision.order.voidReason,
    })
    releaseOrderBay(orderId)
    return { ok: true }
  }

  return { completeOrder, deleteOrder, voidOrder, recordPayment, assignOrderToBay, releaseOrderBay }
}

// The one real instance the running app uses.
const defaultOps = createOrderOps(realOpsDeps)

export const completeOrder = defaultOps.completeOrder
export const deleteOrder = defaultOps.deleteOrder
export const voidOrder = defaultOps.voidOrder
export const recordPayment = defaultOps.recordPayment
export const assignOrderToBay = defaultOps.assignOrderToBay
export const releaseOrderBay = defaultOps.releaseOrderBay
