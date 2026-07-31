// Cross-store orchestration for the work-order lifecycle. Pages call these
// instead of composing store actions themselves, so the status change and its
// inventory side effect can never be applied separately.
import { useWorkOrderStore, WorkOrder } from '../../store/workOrderStore'
import { useInventoryStore } from '../../store/inventoryStore'
import { useVehicleStore } from '../../store/vehicleStore'
import { useServiceEventStore } from '../../store/serviceEventStore'
import { useStockLotStore } from '../../store/stockLotStore'
import { useStockMovementStore } from '../../store/stockMovementStore'
import { drawFifo, LotBalance } from '../inventoryCosting'
import { hydrateLots, qtyOnHand } from '../stockLedger'
import { applyCompletion, firstInsufficientStockProduct } from '../orderLifecycle'
import { buildServiceEventFromOrder } from '../serviceEventLifecycle'
import { applyChangedServiceToSchedule } from './scheduleOps'
import { translate } from '../i18n'

export type CompleteOrderResult =
  | { ok: true; order: WorkOrder }
  | { ok: false; reason: string }

/**
 * Complete an order: flip status, stamp payment, deduct linked stock, and —
 * if any line was tagged as a service item — record a ServiceEvent and move
 * the schedule base for any tagged line marked "changed". A top-up never
 * touches the schedule.
 */
export function completeOrder(
  orderId: string,
  paymentMethod: WorkOrder['paymentMethod']
): CompleteOrderResult {
  const workOrderStore = useWorkOrderStore.getState()
  const order = workOrderStore.getWorkOrder(orderId)
  if (!order) return { ok: false, reason: translate('workOrders.orderNotFoundError') }

  const result = applyCompletion(order, paymentMethod)
  if (!result.ok) return result

  const inventoryStore = useInventoryStore.getState()
  const lotStore = useStockLotStore.getState()
  const movementStore = useStockMovementStore.getState()
  const movements = movementStore.movements

  // Defense-in-depth: refuse to complete if any product-linked line's merged
  // demand exceeds current stock. Checked before any mutation so a rejected
  // completion leaves order status and stock untouched.
  const insufficientProductId = firstInsufficientStockProduct(
    result.stockAdjustments,
    (productId) => qtyOnHand(movements, productId)
  )
  if (insufficientProductId) {
    const productName = inventoryStore.getProduct(insufficientProductId)?.name ?? translate('workOrders.genericItemLabel')
    return { ok: false, reason: translate('workOrders.orderInsufficientStockError', { product: productName }) }
  }

  // Cost the sale before anything is written: draw each product line out of
  // its FIFO lots and freeze what it actually cost onto the line. Done here,
  // not when the line was added, because this is the moment the parts leave
  // the shelf — and once stamped, editing a product's cost price can never
  // move this order's P&L again.
  const occurredAt = result.order.completedAt ?? result.order.createdAt
  // One movement per FIFO draw (plus one for whatever no lot could cover) —
  // together they always sum to exactly this line's quantity, so the ledger
  // needs no separate "adjust stock" step the way the old stored counter did.
  const movementsToAdd: Parameters<typeof movementStore.addMovement>[0][] = []
  // Draws run against a local working copy, not the store: two lines of the
  // same product on one order must not both draw from the same opening lots.
  const workingLots = new Map<string, LotBalance[]>()
  const costedItems = result.order.items.map(item => {
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
      })
    }
    const fallbackCost = Math.round(draw.shortfallQty * fallbackCostPrice)
    return { ...item, costOfGoods: draw.cost + fallbackCost }
  })
  const costedOrder = { ...result.order, items: costedItems }

  workOrderStore.updateWorkOrder(orderId, costedOrder)
  for (const m of movementsToAdd) movementStore.addMovement(m)

  const serviceEvent = buildServiceEventFromOrder(costedOrder)
  if (serviceEvent) {
    useServiceEventStore.getState().addServiceEvent(serviceEvent)

    const currentOdometer = costedOrder.odometerAtService ?? costedOrder.odometerAtArrival
    const completionDate = (costedOrder.completedAt ?? costedOrder.createdAt).slice(0, 10)
    for (const item of costedOrder.items) {
      if (item.serviceItemTypeId && item.serviceAction === 'changed') {
        applyChangedServiceToSchedule(costedOrder.vehicleId, item.serviceItemTypeId, {
          newBaseOdometer: currentOdometer,
          newBaseDate: completionDate,
        })
      }
    }

    if (currentOdometer != null) {
      const vehicleStore = useVehicleStore.getState()
      const vehicle = vehicleStore.getVehicle(costedOrder.vehicleId)
      if (vehicle && currentOdometer > (vehicle.currentMileage ?? 0)) {
        vehicleStore.updateVehicle(vehicle.id, { currentMileage: currentOdometer })
      }
    }
  }

  return { ok: true, order: costedOrder }
}

/** Delete an order; a completed order's consumed stock is put back first. */
export function deleteOrder(orderId: string): void {
  const workOrderStore = useWorkOrderStore.getState()
  const order = workOrderStore.getWorkOrder(orderId)
  if (!order) return

  // Put the stock back at what it cost, not at today's price — one new lot
  // per product line (lots are permanent history, never resurrected), dated
  // when the order consumed it so it re-enters the FIFO queue where it left
  // rather than behind everything bought since. One movement fully accounts
  // for that lot's quantity, so no separate "restore stock" step is needed.
  if (order.status === 'completed') {
    const lotStore = useStockLotStore.getState()
    const movementStore = useStockMovementStore.getState()
    const receivedAt = order.completedAt ?? order.createdAt
    for (const item of order.items) {
      if (!item.productId || item.quantity <= 0) continue
      const unitCost =
        item.costOfGoods != null
          ? Math.round(item.costOfGoods / item.quantity)
          : useInventoryStore.getState().getProduct(item.productId)?.costPrice ?? 0
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
      })
    }
  }
  useServiceEventStore.getState().deleteServiceEventsByWorkOrder(orderId)
  workOrderStore.deleteWorkOrder(orderId)
}
