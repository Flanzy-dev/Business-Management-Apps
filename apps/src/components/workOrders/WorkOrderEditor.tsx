import { useMemo, useState } from 'react'
import { useStoreWithEqualityFn } from 'zustand/traditional'
import { shallow } from 'zustand/shallow'
import { useWorkOrderStore, WorkOrder, WorkOrderItem } from '../../store/workOrderStore'
import { useVehicleStore } from '../../store/vehicleStore'
import { useWorkerStore } from '../../store/workerStore'
import { useCustomerStore } from '../../store/customerStore'
import { useCompanyStore } from '../../store/companyStore'
import { useSettingsStore, DEFAULT_SERVICE_INTERVAL_KM, DEFAULT_PAYMENT_TERM_DAYS } from '../../store/settingsStore'
import type { ProductWithStock } from '../../lib/inventory/stockLedger'
import { ServiceCatalogItem, useServiceCatalogStore } from '../../store/serviceCatalogStore'
import { useScheduleRuleStore } from '../../store/scheduleRuleStore'
import { useServiceEventStore } from '../../store/serviceEventStore'
import { useBayStore } from '../../store/bayStore'
import { useToastStore } from '../../store/uiStores'
import { useTranslation } from '../../lib/i18n'
import { printReceipt, receiptShopInfoFromSettings } from './Receipt'
import { completeOrder, assignOrderToBay, releaseOrderBay } from '../../lib/ops/orderOps'
import { useRecordPayment } from '../../hooks/useRecordPayment'
import { bayHoldingOrder } from '../../lib/orders/bayAssignment'
import { defaultPaymentDueDate } from '../../lib/orders/receivables'
import { catalogIntervalKmFor } from '../../lib/schedule/serviceCatalog'
import { activeRulesForVehicle, groupDueLines } from '../../lib/schedule/scheduleEngine'
import { lastChangeOdometerByItemType, serviceUsageCounts, suggestServices } from '../../lib/schedule/serviceSuggestions'
import { productUsageCounts } from '../../lib/orders/productUsage'
import { addProductToOrder, addServiceToOrder, changeLineQuantity, saveLine, removeLine, restoreLine, type OrderLineResult } from '../../lib/ops/orderLineOps'
import { formatCurrency } from '../../lib/format/numbers'
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
import { canVoidOrder, canExtendPaymentDue } from '../../lib/auth/permissions'
import { isCounterSale, canRecordUnpaid } from '../../lib/orders/orderOwner'
import { ExtendDueDateDialog } from './ExtendDueDateDialog'
import { orderLabel, ownerContact, ownerName, vehicleLabelWithPlate } from '../../lib/format/entities'
import { whatsAppUrl } from '../../lib/schedule/reminders'
import { buildReceiptDueLines } from '../../lib/orders/receiptDueLines'
import { buildThankYouMessage, formatNextDue } from '../../lib/orders/thankYouMessage'
import { visitOdometer } from '../../lib/vehicles/visitOdometer'

// A shop typically has no per-service time estimate on hand at assignment
// time — this is a starting guess the Bays board counts down from, not a
// promise; nothing currently lets staff type a different estimate in.
const DEFAULT_BAY_MINUTES = 60

/**
 * Cashier-checkout screen for one order: tap-to-add product catalog on the
 * left, the running ticket on the right. The ticket-editing rules (stock
 * guards, quantity merging) are src/lib/ops/orderLineOps.ts; this component
 * owns which dialog is open and the toasts. The two panes are presentational.
 * A completed/cancelled order renders the ticket alone.
 */
export function WorkOrderEditor({ orderId, onBack }: { orderId: string; onBack: () => void }) {
  const { t } = useTranslation()
  const workOrders = useWorkOrderStore(s => s.workOrders)
  const order = workOrders.find(wo => wo.id === orderId)
  const customers = useCustomerStore(s => s.customers)
  const companies = useCompanyStore(s => s.companies)
  const vehicles = useVehicleStore(s => s.vehicles)
  const workers = useWorkerStore(s => s.workers)
  const settings = useSettingsStore(s => s.settings)
  const services = useServiceCatalogStore(s => s.services)
  const scheduleRules = useScheduleRuleStore(s => s.scheduleRules)
  const serviceEvents = useServiceEventStore(s => s.serviceEvents)
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
  const mode = useMode()
  const canVoid = canVoidOrder(mode)
  const canExtendDue = canExtendPaymentDue(mode)
  const [showExtendDue, setShowExtendDue] = useState(false)

  // Usage ranking counts completed orders only, and a line tap on an open order
  // never changes one. Selecting just the completed orders with a shallow
  // compare keeps this list's identity across those taps, so the two counts
  // below are not redone over every order in the shop each time.
  const completedOrders = useStoreWithEqualityFn(
    useWorkOrderStore,
    (s) => s.workOrders.filter((wo) => wo.status === 'completed'),
    shallow
  )
  const serviceUsage = useMemo(() => serviceUsageCounts(completedOrders), [completedOrders])
  const productUsage = useMemo(() => productUsageCounts(completedOrders), [completedOrders])

  /**
   * What this car is *due* for — nothing softer than that. A vehicle with a
   * schedule rule is judged by the rule; one without (most of them) by how far
   * it has run since that item was last changed. Recomputed as the tech types
   * the odometer, so the distances stay honest. Nothing to suggest on a
   * completed order — it can't be added to.
   */
  const suggestions = useMemo(() => {
    // A counter sale has no car to be due for anything.
    if (!order || order.status !== 'open' || isCounterSale(order)) return []
    const vehicle = vehicles.find(v => v.id === order.vehicleId)
    // The service reading wins once entered; arrival, then the vehicle's own
    // last-known mileage, are the fallbacks.
    const currentOdometer =
      visitOdometer(order) ?? vehicle?.currentMileage ?? 0
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

  // After a visit is charged: a WhatsApp thank-you carrying the same next-service
  // marks the receipt prints. Only when the owner has a number on file.
  // The message is about a car and its next service, so a counter sale (no car) gets none.
  const ownerPhone = ownerContact(vehicle, customers, companies)?.phone
  const thankYouUrl =
    order.status === 'completed' && !isCounterSale(order) && ownerPhone
      ? whatsAppUrl(
          ownerPhone,
          buildThankYouMessage(t, {
            owner: ownerName(vehicle, customers, companies),
            vehicle: vehicleLabelWithPlate(vehicle),
            shop: settings.shopName?.trim() || t('receipt.defaultShopName'),
            nextDue: formatNextDue(
              buildReceiptDueLines(order.vehicleId, visitOdometer(order) ?? vehicle?.currentMileage ?? 0)
            ),
          })
        )
      : null

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

  // The rules for changing an open ticket — stock guards, bumping a matching
  // line instead of stacking, the "may grow to free + already held" cap — live
  // in src/lib/ops/orderLineOps.ts, which reads the order fresh on every call
  // (two taps in one batch see each other's line). This only turns a refusal
  // into a toast.
  const toastRefusal = (result: OrderLineResult) => {
    if (result.ok) return
    if (result.reason === 'outOfStock') {
      showToast({
        tone: 'danger',
        title: t('workOrders.outOfStockTitle'),
        description: t('workOrders.outOfStockDescription', { product: result.product.name }),
      })
      return
    }
    showToast({
      tone: 'warning',
      title: t('workOrders.insufficientStockTitle'),
      description: t('workOrders.insufficientStockDescription', {
        qty: result.available,
        unit: result.product.unit,
        product: result.product.name,
      }),
    })
  }

  const handleAddProduct = (product: ProductWithStock) => toastRefusal(addProductToOrder(order.id, product.id))

  const handleAddService = (service: ServiceCatalogItem) => toastRefusal(addServiceToOrder(order.id, service))

  const handleQtyChange = (item: WorkOrderItem, delta: number) => toastRefusal(changeLineQuantity(order.id, item.id, delta))

  // A removed line comes back with one tap: no confirm on the trash button,
  // an Undo on the toast instead.
  const handleRemove = (itemId: string) => {
    const removed = removeLine(order.id, itemId)
    if (!removed) return
    showToast({
      tone: 'neutral',
      title: t('workOrders.lineRemovedToast', { item: removed.description }),
      action: { label: t('workOrders.undoAction'), onClick: () => toastRefusal(restoreLine(order.id, removed)) },
    })
  }

  const handleSaveLine = (draft: LineItemDraft) => {
    if (!customItemOpen && !editingLine) return
    const result = saveLine(order.id, customItemOpen ? null : editingLine!.id, draft)
    toastRefusal(result)
    if (!result.ok) return
    setCustomItemOpen(false)
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
        order: orderLabel(result.order.orderNumber, result.order.orderNumberSuffix),
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
      onRemove={handleRemove}
      onCharge={() => setShowPayment(true)}
      onPrint={() => printReceipt(order, receiptShopInfo)}
      onRecordPayment={() => setShowRecordPayment(true)}
      onExtendDue={canExtendDue ? () => setShowExtendDue(true) : undefined}
      thankYouUrl={thankYouUrl}
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
        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_320px] lg:grid-cols-[minmax(0,1fr)_380px] gap-4">
          <CheckoutCatalog
            items={order.items}
            suggestions={suggestions}
            serviceUsage={serviceUsage}
            productUsage={productUsage}
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
                handleRemove(editingLine.id)
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
        allowPending={canRecordUnpaid(order)}
        pendingUnavailableHint={t('workOrders.pendingNeedsCustomerHint')}
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

      <ExtendDueDateDialog open={showExtendDue} order={order} onClose={() => setShowExtendDue(false)} />

      <OrderDetailsDialog open={showDetails} order={order} onClose={() => setShowDetails(false)} />

      <VoidOrderDialog order={showVoid ? order : null} onClose={() => setShowVoid(false)} onVoided={onBack} />
    </div>
  )
}
