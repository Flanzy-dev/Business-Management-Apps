import { useMemo, useState } from 'react'
import { useWorkOrderStore, WorkOrder, WorkOrderItem } from '../../store/workOrderStore'
import { useVehicleStore } from '../../store/vehicleStore'
import { useWorkerStore } from '../../store/workerStore'
import { useCustomerStore } from '../../store/customerStore'
import { useCompanyStore } from '../../store/companyStore'
import { useSettingsStore, DEFAULT_SERVICE_INTERVAL_KM, DEFAULT_PAYMENT_TERM_DAYS } from '../../store/settingsStore'
import { useProductStock } from '../../hooks/useProductStock'
import type { ProductWithStock } from '../../lib/stockLedger'
import { ServiceCatalogItem, useServiceCatalogStore } from '../../store/serviceCatalogStore'
import { useScheduleRuleStore } from '../../store/scheduleRuleStore'
import { useServiceEventStore } from '../../store/serviceEventStore'
import { useServiceItemTypeStore } from '../../store/serviceItemTypeStore'
import { useProductCategoryStore } from '../../store/productCategoryStore'
import { useBayStore } from '../../store/bayStore'
import { useToastStore } from '../../store/toastStore'
import { useTranslation } from '../../lib/i18n'
import { printReceipt, receiptShopInfoFromSettings } from '../Receipt'
import { completeOrder, assignOrderToBay, releaseOrderBay } from '../../lib/ops/orderOps'
import { useRecordPayment } from '../../hooks/useRecordPayment'
import { bayHoldingOrder } from '../../lib/bayAssignment'
import { defaultPaymentDueDate } from '../../lib/receivables'
import { remainingStock } from '../../lib/orderLifecycle'
import { serviceCatalogLine, catalogIntervalKmFor } from '../../lib/serviceCatalog'
import { resolveProductScheduleTag } from '../../lib/scheduleTagging'
import { activeRulesForVehicle, groupDueLines } from '../../lib/scheduleEngine'
import { lastChangeOdometerByItemType, serviceUsageCounts, suggestServices } from '../../lib/serviceSuggestions'
import { findMatchingProductLine, buildProductLine, findMatchingServiceLine } from '../../lib/workOrderLines'
import { formatCurrency } from '../../lib/currency'
import { Button } from '../ui/Button'
import { AdjustStockDialog } from '../inventory/AdjustStockDialog'
import { CheckoutCatalog } from './CheckoutCatalog'
import { CheckoutTicket } from './CheckoutTicket'
import { LineItemDialog, LineItemDraft } from './LineItemDialog'
import { OrderDetailsDialog } from './OrderDetailsDialog'
import { PaymentDialog } from './PaymentDialog'
import { VoidOrderDialog } from './VoidOrderDialog'
import { WorkOrderHeader } from './WorkOrderHeader'
import { useMode } from '../../store/authStore'
import { canVoidOrder } from '../../lib/auth/permissions'

// A shop typically has no per-service time estimate on hand at assignment
// time — this is a starting guess the Bays board counts down from, not a
// promise; nothing currently lets staff type a different estimate in.
const DEFAULT_BAY_MINUTES = 60

/**
 * Cashier-checkout screen for one order: tap-to-add product catalog on the
 * left, the running ticket on the right. This component owns the interaction
 * rules (stock guards, quantity merging, which dialog is open); the two panes
 * are presentational. A completed/cancelled order renders the ticket alone.
 */
export function WorkOrderEditor({ orderId, onBack }: { orderId: string; onBack: () => void }) {
  const { t } = useTranslation()
  const workOrders = useWorkOrderStore(s => s.workOrders)
  const order = workOrders.find(wo => wo.id === orderId)
  const addItem = useWorkOrderStore(s => s.addItem)
  const updateItem = useWorkOrderStore(s => s.updateItem)
  const removeItem = useWorkOrderStore(s => s.removeItem)
  const customers = useCustomerStore(s => s.customers)
  const companies = useCompanyStore(s => s.companies)
  const vehicles = useVehicleStore(s => s.vehicles)
  const workers = useWorkerStore(s => s.workers)
  const settings = useSettingsStore(s => s.settings)
  const products = useProductStock()
  const services = useServiceCatalogStore(s => s.services)
  const scheduleRules = useScheduleRuleStore(s => s.scheduleRules)
  const serviceEvents = useServiceEventStore(s => s.serviceEvents)
  const serviceItemTypes = useServiceItemTypeStore(s => s.serviceItemTypes)
  const productCategories = useProductCategoryStore(s => s.categories)
  const bays = useBayStore(s => s.bays)
  const showToast = useToastStore(s => s.show)
  const recordPaymentWithToast = useRecordPayment()

  const [editingLine, setEditingLine] = useState<WorkOrderItem | null>(null)
  const [customItemOpen, setCustomItemOpen] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [showRecordPayment, setShowRecordPayment] = useState(false)
  // Double-clicking a sold-out tile in CheckoutCatalog opens this — see
  // ProductTile's onRestock. Not auto-added to the ticket once saved; the
  // cashier taps the now-live tile themselves.
  const [restockingProduct, setRestockingProduct] = useState<ProductWithStock | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [showVoid, setShowVoid] = useState(false)
  const canVoid = canVoidOrder(useMode())

  const serviceUsage = useMemo(() => serviceUsageCounts(workOrders), [workOrders])

  /**
   * What this car is *due* for — nothing softer than that. A vehicle with a
   * schedule rule is judged by the rule; one without (most of them) by how far
   * it has run since that item was last changed. Recomputed as the tech types
   * the odometer, so the distances stay honest. Nothing to suggest on a
   * completed order — it can't be added to.
   */
  const suggestions = useMemo(() => {
    if (!order || order.status !== 'open') return []
    const vehicle = vehicles.find(v => v.id === order.vehicleId)
    // The service reading wins once entered; arrival, then the vehicle's own
    // last-known mileage, are the fallbacks.
    const currentOdometer =
      order.odometerAtService ?? order.odometerAtArrival ?? vehicle?.currentMileage ?? 0
    const liveRules = activeRulesForVehicle(scheduleRules, order.vehicleId)
    const shopDefaultIntervalKm = settings.defaultServiceIntervalKm ?? DEFAULT_SERVICE_INTERVAL_KM

    return suggestServices({
      services,
      ticketItems: order.items,
      dueLines: groupDueLines(liveRules),
      currentOdometer,
      currentDate: new Date(),
      lastChangeByItemType: lastChangeOdometerByItemType(
        serviceEvents.filter(e => e.vehicleId === order.vehicleId)
      ),
      ruleItemTypeIds: new Set(liveRules.map(r => r.itemTypeId)),
      // The real per-item interval (brake fluid's 40,000 km, not the shop's
      // generic oil-change default) — see serviceCatalog.ts's
      // catalogIntervalKmFor.
      intervalKmFor: (itemTypeId) => catalogIntervalKmFor(services, itemTypeId, shopDefaultIntervalKm),
    })
  }, [order, vehicles, scheduleRules, serviceEvents, services, settings.defaultServiceIntervalKm])

  if (!order) return null

  const readOnly = order.status !== 'open'
  const vehicle = vehicles.find(v => v.id === order.vehicleId)

  const receiptShopInfo = receiptShopInfoFromSettings(settings)

  // This vehicle's current live interval for a given item type, or null if it
  // has none yet — the requested-interval field's placeholder in
  // ServiceTagFields, so staff only type a number when the customer's differs
  // from what's already set.
  const getLiveIntervalKm = (itemTypeId: string): number | null =>
    activeRulesForVehicle(scheduleRules, order.vehicleId).find(r => r.itemTypeId === itemTypeId)?.intervalKm ?? null

  // Bay occupancy is derived from the order lifecycle (src/lib/ops/orderOps.ts
  // releases it on complete/void/delete) — this page is the one place it's
  // ever claimed. A bay not currently holding this order, plus this order's
  // own bay if it has one (so re-picking the same bay still shows selected).
  const assignedBay = bayHoldingOrder(bays, order.id)
  const bayOptions = bays.filter(b => b.status === 'available' || b.id === assignedBay?.id)

  const handleBayChange = (bayId: string) => {
    if (!bayId) {
      releaseOrderBay(order.id)
      return
    }
    assignOrderToBay(order.id, bayId, order.workerId, DEFAULT_BAY_MINUTES)
  }

  const outOfStockToast = (product: ProductWithStock) =>
    showToast({
      tone: 'danger',
      title: t('workOrders.outOfStockTitle'),
      description: t('workOrders.outOfStockDescription', { product: product.name }),
    })

  const insufficientStockToast = (product: ProductWithStock, available: number) =>
    showToast({
      tone: 'warning',
      title: t('workOrders.insufficientStockTitle'),
      description: t('workOrders.insufficientStockDescription', {
        qty: available,
        unit: product.unit,
        product: product.name,
      }),
    })

  /**
   * Tap-to-add. Stock is checked against what's left *after* quantity already
   * reserved by this order's own lines, so repeat taps can't sell past what's
   * on hand. A second tap on a product already on the ticket bumps that line
   * rather than stacking duplicates, matching on the schedule tag the way
   * handleAddService already does — a line the tech has hand-edited (e.g.
   * untagged for an over-the-counter sale) never silently absorbs a fresh tap.
   *
   * A product resolving to a schedule item (src/lib/scheduleTagging.ts — by
   * its own override or its category, e.g. every engine-oil product tags
   * "Oli Mesin") is added already tagged as a "changed" service, the same
   * shape serviceCatalogLine gives a linked catalog service. This is what
   * lets an ordinary oil-off-the-shelf sale advance the vehicle's schedule
   * without anyone ticking a box — see ServiceTagFields for how a tech can
   * still untick or retag it before completing.
   *
   * Reads items fresh from the store rather than the `order` render closure:
   * two taps landing in the same event/batch (e.g. a fast double-click) must
   * see each other's effect, or both find "no existing line" and add two.
   */
  const handleAddProduct = (product: ProductWithStock) => {
    const items = useWorkOrderStore.getState().workOrders.find(wo => wo.id === order.id)?.items ?? []
    if (remainingStock(items, product) <= 0) return outOfStockToast(product)

    const serviceItemTypeId = resolveProductScheduleTag(product, productCategories, serviceItemTypes) ?? null

    const existing = findMatchingProductLine(items, product.id, serviceItemTypeId)
    if (existing) {
      updateItem(order.id, existing.id, { quantity: existing.quantity + 1 })
      return
    }
    addItem(order.id, buildProductLine(product, serviceItemTypeId))
  }

  /**
   * Same tap-to-add rule as products, minus the stock guard — labor can't run
   * out. A repeat tap bumps the matching line, where "matching" includes the
   * schedule tag so a tagged service never merges into an untagged line of the
   * same name (that would hand the schedule a service it wasn't told about).
   * Reads items fresh from the store — see handleAddProduct.
   */
  const handleAddService = (service: ServiceCatalogItem) => {
    const items = useWorkOrderStore.getState().workOrders.find(wo => wo.id === order.id)?.items ?? []
    const line = serviceCatalogLine(service)
    const existing = findMatchingServiceLine(items, line)
    if (existing) {
      updateItem(order.id, existing.id, { quantity: existing.quantity + 1 })
      return
    }
    addItem(order.id, line)
  }

  const handleQtyChange = (item: WorkOrderItem, delta: number) => {
    // Fresh from the store, not the render closure — two fast +/- clicks in one
    // batch must see each other's effect, same reason handleAddProduct documents.
    const items = useWorkOrderStore.getState().workOrders.find(wo => wo.id === order.id)?.items ?? []
    const current = items.find(i => i.id === item.id) ?? item
    const nextQuantity = current.quantity + delta
    if (nextQuantity <= 0) {
      removeItem(order.id, item.id)
      return
    }
    if (delta > 0 && current.productId) {
      const product = products.find(p => p.id === current.productId)
      if (product && remainingStock(items, product) <= 0) {
        // Report what's actually free after this ticket's own lines, not total on hand.
        return insufficientStockToast(product, Math.max(0, remainingStock(items, product)))
      }
    }
    updateItem(order.id, item.id, { quantity: nextQuantity })
  }

  const handleSaveLine = (draft: LineItemDraft) => {
    const fields = {
      description: draft.description,
      quantity: draft.quantity,
      unitPrice: draft.unitPrice,
      kind: draft.kind,
      serviceItemTypeId: draft.serviceItemTypeId,
      quantityLiters: draft.quantityLiters,
      serviceAction: draft.serviceAction,
      containerType: draft.containerType,
      requestedIntervalKm: draft.requestedIntervalKm,
    }

    if (customItemOpen) {
      addItem(order.id, { ...fields, productId: null })
      setCustomItemOpen(false)
      return
    }
    if (!editingLine) return

    if (editingLine.productId) {
      const product = products.find(p => p.id === editingLine.productId)
      // What this line may grow to: everything still free, plus whatever this
      // same line is already holding.
      const allowed = product ? remainingStock(order.items, product) + editingLine.quantity : Infinity
      if (product && draft.quantity > allowed) {
        return insufficientStockToast(product, Math.max(0, allowed))
      }
    }
    updateItem(order.id, editingLine.id, fields)
    setEditingLine(null)
  }

  const handleComplete = (
    paymentMethod: WorkOrder['paymentMethod'],
    amountReceived: number | null,
    paymentDueDate: string | null
  ) => {
    const result = completeOrder(order.id, paymentMethod, amountReceived, paymentDueDate)
    setShowPayment(false)
    if (!result.ok) {
      showToast({ tone: 'danger', title: t('workOrders.cannotCompleteTitle'), description: result.reason })
      return
    }
    printReceipt(result.order, receiptShopInfo)
    showToast({
      tone: 'success',
      title: t('workOrders.orderCompletedTitle'),
      description: t('workOrders.orderCompletedDescription', {
        order: `SB-${result.order.orderNumber}`,
        amount: formatCurrency(result.order.total),
      }),
    })
    onBack()
  }

  const handleRecordPayment = (method: WorkOrder['paymentMethod'], amountReceived: number | null) => {
    setShowRecordPayment(false)
    recordPaymentWithToast(order.id, method, amountReceived)
  }

  const ticket = (
    <CheckoutTicket
      order={order}
      readOnly={readOnly}
      onEditLine={setEditingLine}
      onQtyChange={handleQtyChange}
      onRemove={itemId => removeItem(order.id, itemId)}
      onCharge={() => setShowPayment(true)}
      onPrint={() => printReceipt(order, receiptShopInfo)}
      onRecordPayment={() => setShowRecordPayment(true)}
    />
  )

  return (
    <div className="h-full flex flex-col">
      <WorkOrderHeader
        order={order}
        vehicle={vehicle}
        customers={customers}
        companies={companies}
        workers={workers}
        readOnly={readOnly}
        assignedBayId={assignedBay?.id}
        bayOptions={bayOptions}
        onBayChange={handleBayChange}
        onBack={onBack}
        onEditDetails={() => setShowDetails(true)}
      />

      {readOnly ? (
        <div className="flex-1 min-h-0 flex justify-center">
          <div className="w-full max-w-md flex flex-col min-h-0 gap-3">
            {ticket}
            {canVoid && order.status === 'completed' && (
              <Button variant="danger" size="touch" onClick={() => setShowVoid(true)} className="w-full shrink-0">
                {t('workOrders.voidOrderAction')}
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-4">
          <CheckoutCatalog
            items={order.items}
            suggestions={suggestions}
            serviceUsage={serviceUsage}
            onAddProduct={handleAddProduct}
            onAddService={handleAddService}
            onCustomItem={() => setCustomItemOpen(true)}
            onRestockProduct={setRestockingProduct}
          />
          {ticket}
        </div>
      )}

      <LineItemDialog
        open={customItemOpen || !!editingLine}
        mode={customItemOpen ? 'custom' : 'edit'}
        item={editingLine ?? undefined}
        onSave={handleSaveLine}
        getLiveIntervalKm={getLiveIntervalKm}
        onRemove={
          editingLine
            ? () => {
                removeItem(order.id, editingLine.id)
                setEditingLine(null)
              }
            : undefined
        }
        onClose={() => {
          setCustomItemOpen(false)
          setEditingLine(null)
        }}
      />

      <AdjustStockDialog
        open={!!restockingProduct}
        product={restockingProduct}
        onClose={() => setRestockingProduct(null)}
      />

      <PaymentDialog
        open={showPayment}
        total={order.total}
        defaultDueDate={defaultPaymentDueDate(new Date(), settings.defaultPaymentTermDays ?? DEFAULT_PAYMENT_TERM_DAYS)}
        onClose={() => setShowPayment(false)}
        onConfirm={handleComplete}
      />

      <PaymentDialog
        open={showRecordPayment}
        total={order.total}
        allowPending={false}
        selectTitle={t('workOrders.selectPaymentMethodForRecordTitle')}
        onClose={() => setShowRecordPayment(false)}
        onConfirm={handleRecordPayment}
      />

      <OrderDetailsDialog open={showDetails} order={order} onClose={() => setShowDetails(false)} />

      <VoidOrderDialog order={showVoid ? order : null} onClose={() => setShowVoid(false)} onVoided={onBack} />
    </div>
  )
}
