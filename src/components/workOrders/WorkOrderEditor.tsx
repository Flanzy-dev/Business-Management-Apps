import { useMemo, useState } from 'react'
import { useWorkOrderStore, WorkOrder, WorkOrderItem } from '../../store/workOrderStore'
import { useVehicleStore } from '../../store/vehicleStore'
import { useWorkerStore } from '../../store/workerStore'
import { useCustomerStore } from '../../store/customerStore'
import { useCompanyStore } from '../../store/companyStore'
import { useSettingsStore, DEFAULT_SERVICE_INTERVAL_KM } from '../../store/settingsStore'
import { useProductStock } from '../../hooks/useProductStock'
import type { ProductWithStock } from '../../lib/stockLedger'
import { ServiceCatalogItem, useServiceCatalogStore } from '../../store/serviceCatalogStore'
import { useScheduleRuleStore } from '../../store/scheduleRuleStore'
import { useServiceEventStore } from '../../store/serviceEventStore'
import { useToastStore } from '../../store/toastStore'
import { useTranslation } from '../../lib/i18n'
import { printReceipt } from '../Receipt'
import { completeOrder } from '../../lib/ops/orderOps'
import { remainingStock } from '../../lib/orderLifecycle'
import { serviceCatalogLine } from '../../lib/serviceCatalog'
import { groupDueLines } from '../../lib/scheduleEngine'
import { lastChangeOdometerByItemType, serviceUsageCounts, suggestServices } from '../../lib/serviceSuggestions'
import { formatCurrency } from '../../lib/currency'
import { vehicleLabelWithPlate, ownerName, workerName } from '../../lib/entities'
import { Dialog, DialogFooter } from '../ui/Dialog'
import { StatusBadge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { CheckoutCatalog } from './CheckoutCatalog'
import { CheckoutTicket } from './CheckoutTicket'
import { LineItemDialog, LineItemDraft } from './LineItemDialog'

const PAYMENT_METHOD_LABEL_KEYS: Record<'cash' | 'qris' | 'card' | 'check', string> = {
  cash: 'paymentCash',
  qris: 'paymentQris',
  card: 'paymentCard',
  check: 'paymentCheck',
}

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
  const showToast = useToastStore(s => s.show)

  const [editingLine, setEditingLine] = useState<WorkOrderItem | null>(null)
  const [customItemOpen, setCustomItemOpen] = useState(false)
  const [showPayment, setShowPayment] = useState(false)

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
    const liveRules = scheduleRules.filter(r => r.vehicleId === order.vehicleId && r.supersededAt === null)
    const intervalKm = settings.defaultServiceIntervalKm ?? DEFAULT_SERVICE_INTERVAL_KM

    return suggestServices({
      services,
      ticketItems: order.items,
      dueLines: groupDueLines(liveRules),
      currentOdometer,
      lastChangeByItemType: lastChangeOdometerByItemType(
        serviceEvents.filter(e => e.vehicleId === order.vehicleId)
      ),
      ruleItemTypeIds: new Set(liveRules.map(r => r.itemTypeId)),
      intervalKmFor: () => intervalKm,
    })
  }, [order, vehicles, scheduleRules, serviceEvents, services, settings.defaultServiceIntervalKm])

  if (!order) return null

  const readOnly = order.status !== 'open'
  const vehicle = vehicles.find(v => v.id === order.vehicleId)

  const receiptShopInfo = {
    shopName: settings.shopName,
    shopAddress: settings.shopAddress,
    shopPhone: settings.shopPhone,
    footerText: settings.receiptFooter,
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
   * rather than stacking duplicates — except for a line that carries service
   * tagging, which stays its own line so its schedule data isn't diluted.
   *
   * Reads items fresh from the store rather than the `order` render closure:
   * two taps landing in the same event/batch (e.g. a fast double-click) must
   * see each other's effect, or both find "no existing line" and add two.
   */
  const handleAddProduct = (product: ProductWithStock) => {
    const items = useWorkOrderStore.getState().workOrders.find(wo => wo.id === order.id)?.items ?? []
    if (remainingStock(items, product) <= 0) return outOfStockToast(product)

    const existing = items.find(i => i.productId === product.id && !i.serviceItemTypeId)
    if (existing) {
      updateItem(order.id, existing.id, { quantity: existing.quantity + 1 })
      return
    }
    addItem(order.id, {
      description: product.name,
      quantity: 1,
      unitPrice: product.sellPrice,
      productId: product.id,
    })
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
    const existing = items.find(
      i =>
        !i.productId &&
        i.description === line.description &&
        (i.serviceItemTypeId ?? null) === (line.serviceItemTypeId ?? null)
    )
    if (existing) {
      updateItem(order.id, existing.id, { quantity: existing.quantity + 1 })
      return
    }
    addItem(order.id, line)
  }

  const handleQtyChange = (item: WorkOrderItem, delta: number) => {
    const nextQuantity = item.quantity + delta
    if (nextQuantity <= 0) {
      removeItem(order.id, item.id)
      return
    }
    if (delta > 0 && item.productId) {
      const product = products.find(p => p.id === item.productId)
      if (product && remainingStock(order.items, product) <= 0) {
        return insufficientStockToast(product, Math.max(0, product.qtyOnHand))
      }
    }
    updateItem(order.id, item.id, { quantity: nextQuantity })
  }

  const handleSaveLine = (draft: LineItemDraft) => {
    const fields = {
      description: draft.description,
      quantity: draft.quantity,
      unitPrice: draft.unitPrice,
      serviceItemTypeId: draft.serviceItemTypeId,
      quantityLiters: draft.quantityLiters,
      serviceAction: draft.serviceAction,
      containerType: draft.containerType,
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

  const handleComplete = (paymentMethod: WorkOrder['paymentMethod']) => {
    const result = completeOrder(order.id, paymentMethod)
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

  const ticket = (
    <CheckoutTicket
      order={order}
      readOnly={readOnly}
      onEditLine={setEditingLine}
      onQtyChange={handleQtyChange}
      onRemove={itemId => removeItem(order.id, itemId)}
      onCharge={() => setShowPayment(true)}
      onPrint={() => printReceipt(order, receiptShopInfo)}
    />
  )

  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 flex flex-wrap items-center gap-x-4 gap-y-2 mb-4">
        <button onClick={onBack} className="text-text-secondary hover:text-text-primary focus-ring rounded-radius-xs">
          {t('workOrders.backLink')}
        </button>
        <h1 className="text-page-title text-text-primary">Order SB-{order.orderNumber}</h1>
        <StatusBadge status={order.status} />
        <p className="text-sm text-text-secondary">
          <span className="text-text-primary">{ownerName(vehicle, customers, companies)}</span>
          {' • '}
          {vehicleLabelWithPlate(vehicle)}
          {' • '}
          {workerName(order.workerId, workers)}
        </p>
      </div>

      {readOnly ? (
        <div className="flex-1 min-h-0 flex justify-center">
          <div className="w-full max-w-md flex flex-col min-h-0">{ticket}</div>
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
          />
          {ticket}
        </div>
      )}

      <LineItemDialog
        open={customItemOpen || !!editingLine}
        mode={customItemOpen ? 'custom' : 'edit'}
        item={editingLine ?? undefined}
        onSave={handleSaveLine}
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

      <Dialog open={showPayment} onClose={() => setShowPayment(false)} title={t('workOrders.selectPaymentMethodTitle')} size="sm">
        <div className="space-y-2">
          {(['cash', 'qris', 'card', 'check'] as const).map(method => (
            <button
              key={method}
              onClick={() => handleComplete(method)}
              className="w-full min-h-[44px] p-3 bg-surface-sunken border border-border-subtle rounded-radius-sm hover:border-accent text-left text-text-primary transition-colors focus-ring"
            >
              {t(`workOrders.${PAYMENT_METHOD_LABEL_KEYS[method]}`)}
            </button>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setShowPayment(false)}>
            {t('common.cancel')}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}
