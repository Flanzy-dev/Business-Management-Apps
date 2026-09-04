import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { newEntity, updateById, removeById, findById } from './entityHelpers'
import { getStorageAdapter } from '../lib/storageAdapter'
import { newId } from '../lib/id'
import type { ContainerType } from './serviceEventStore'

export interface WorkOrderItem {
  id: string
  description: string
  quantity: number
  unitPrice: number // whole Rupiah
  lineTotal: number // whole Rupiah
  productId?: string | null // set when the line came from an inventory product (drives stock auto-deduct on completion)
  // Display-only Product/Service classification for a hand-typed custom line
  // (src/components/workOrders/LineItemDialog.tsx) — a productId line is
  // always 'product' regardless of this field. Undefined on every line added
  // before this existed and on catalog services (serviceCatalogLine stamps
  // 'service' explicitly); src/lib/orderItemGroups.ts's itemKind() falls back
  // to the productId check for those. Never consulted for costing — an
  // uncosted custom line must not be able to inflate the parts gross margin,
  // so src/lib/finance.ts's computeCogsBreakdown keeps keying off productId.
  kind?: 'product' | 'service' | null
  // What this line's stock actually cost the shop, in whole Rupiah, TOTAL for
  // the line — stamped when the order completes and the parts leave the shelf
  // (see src/lib/ops/orderOps.ts). A total rather than a unit cost because one
  // line can draw from several FIFO lots at different prices. Frozen on
  // purpose: editing a product's cost price later must not move a past P&L.
  // Undefined on lines sold before lot costing existed — computeCogs falls
  // back to the product's current cost price for those.
  costOfGoods?: number | null
  // Optional service-schedule tagging — undefined/null for ordinary parts/labor
  // lines. Only a line the tech explicitly tags feeds ServiceEvent/ScheduleRule
  // (see src/lib/serviceEventLifecycle.ts, src/lib/ops/orderOps.ts).
  serviceItemTypeId?: string | null
  quantityLiters?: number | null
  serviceAction?: 'changed' | 'topped_up' | null
  containerType?: ContainerType | null // what the oil/fluid was dispensed from
  // The interval the customer asked for at the counter ("ganti tiap 3.000 km"),
  // applied to this vehicle's schedule when the order completes. Only ever set
  // on a 'changed' line — see src/lib/ops/scheduleOps.ts.
  requestedIntervalKm?: number | null
}

export interface WorkOrder {
  id: string
  orderNumber: number
  // References
  vehicleId: string
  workerId: string | null
  driverId: string | null // for fleet vehicles
  // Service info — captured separately since a car may sit before being
  // worked on; odometerAtService may differ from the reading at intake.
  odometerAtArrival: number | null
  odometerAtService: number | null
  date: string
  // Line items
  items: WorkOrderItem[]
  // Totals (all in whole Rupiah)
  subtotal: number
  discountAmount: number
  taxPercent: number
  taxAmount: number
  total: number
  // Payment
  paymentMethod: 'cash' | 'qris' | 'card' | 'check' | 'pending'
  // Status
  status: 'open' | 'completed' | 'cancelled'
  notes: string
  createdAt: string
  completedAt: string | null
  // Cash tendered by the customer, whole Rupiah — set only for cash payments
  // where the cashier recorded it (change-due is derived on the receipt).
  // Optional key, not just nullable: orders predating this field simply won't
  // have it, same convention as WorkOrderItem.costOfGoods.
  amountReceived?: number | null
  // Set when a completed order is voided (src/lib/ops/orderOps.ts's voidOrder):
  // the row is kept (status becomes 'cancelled') so the sale stays in history
  // rather than vanishing the way a hard delete makes it.
  voidedAt?: string | null
  voidReason?: string | null
  // When the customer promised to pay — only meaningful while
  // paymentMethod === 'pending' (src/lib/orderLifecycle.ts's applyCompletion
  // only ever sets it in that case). YYYY-MM-DD, editable at checkout,
  // prefilled from settingsStore's defaultPaymentTermDays.
  paymentDueDate?: string | null
  // Stamped when a pending order's debt is collected
  // (src/lib/ops/orderOps.ts's recordPayment, via applyPayment). At that
  // point paymentMethod flips to the real method it was paid with, so this
  // is only evidence of *when* — not which order needs it going forward.
  paidAt?: string | null
}

// Lifecycle transitions (complete, delete) live in src/lib/ops/orderOps.ts —
// they carry inventory side effects that must never be applied separately.
interface WorkOrderStore {
  workOrders: WorkOrder[]
  nextOrderNumber: number
  addWorkOrder: (data: Omit<WorkOrder, 'id' | 'orderNumber' | 'createdAt' | 'completedAt'>) => WorkOrder
  updateWorkOrder: (id: string, data: Partial<WorkOrder>) => void
  deleteWorkOrder: (id: string) => void
  getWorkOrder: (id: string) => WorkOrder | undefined
  getWorkOrdersByVehicle: (vehicleId: string) => WorkOrder[]
  addItem: (workOrderId: string, item: Omit<WorkOrderItem, 'id' | 'lineTotal'>) => void
  updateItem: (workOrderId: string, itemId: string, data: Partial<WorkOrderItem>) => void
  removeItem: (workOrderId: string, itemId: string) => void
  recalculateTotals: (workOrderId: string) => void
  /** Sets discountAmount and recomputes totals in one store write, instead of
   *  updateWorkOrder + recalculateTotals's two — halves the persist traffic
   *  (each write round-trips through Electron IPC to a full SQLite flush) on
   *  a field that's edited by rapid individual keystrokes. See
   *  CheckoutTicket.tsx's discount field. */
  setDiscount: (workOrderId: string, discountAmount: number) => void
  /** Same one-write treatment as setDiscount, for the tax-percent field. */
  setTaxPercent: (workOrderId: string, taxPercent: number) => void
}

function calculateTotals(items: WorkOrderItem[], discountAmount: number, taxPercent: number) {
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0)
  // Clamp what's actually stored/displayed, not just what the total floors
  // to — an over-entered discount (typo, or removing items after typing a
  // big discount in) must never print a "Discount: -Rp150,000" line above a
  // "Total: Rp0" on a Rp100,000 order.
  const clampedDiscount = Math.min(Math.max(0, discountAmount), subtotal)
  const afterDiscount = subtotal - clampedDiscount
  const taxAmount = Math.round(afterDiscount * (taxPercent / 100))
  const total = afterDiscount + taxAmount
  return { subtotal, discountAmount: clampedDiscount, taxAmount, total }
}

export const useWorkOrderStore = create<WorkOrderStore>()(
  persist(
    (set, get) => ({
      workOrders: [],
      nextOrderNumber: 1001,

      addWorkOrder: (data) => {
        // nextOrderNumber is per-device state — src/lib/sync/syncFields.ts syncs
        // only the workOrders list, not this counter, so two devices' counters
        // drift apart and can hand out the same SB-#### in one shift. Derive
        // from the highest number actually on hand (local + anything synced in
        // from other devices) so it self-heals the moment another device's
        // orders arrive; keep max() with the stored counter so deleting the
        // newest order can't reuse its number.
        const highestExisting = get().workOrders.reduce((m, wo) => Math.max(m, wo.orderNumber), 0)
        const orderNumber = Math.max(get().nextOrderNumber, highestExisting + 1)
        const workOrder: WorkOrder = {
          ...newEntity(data),
          orderNumber,
          completedAt: null,
        }
        set((state) => ({
          workOrders: [...state.workOrders, workOrder],
          nextOrderNumber: orderNumber + 1,
        }))
        return workOrder
      },

      updateWorkOrder: (id, data) => {
        set((state) => ({ workOrders: updateById(state.workOrders, id, data) }))
      },

      deleteWorkOrder: (id) => {
        set((state) => ({ workOrders: removeById(state.workOrders, id) }))
      },

      getWorkOrder: (id) => {
        return findById(get().workOrders, id)
      },

      getWorkOrdersByVehicle: (vehicleId) => {
        return get().workOrders.filter((wo) => wo.vehicleId === vehicleId)
      },

      addItem: (workOrderId, itemData) => {
        const item: WorkOrderItem = {
          ...itemData,
          id: newId(),
          lineTotal: Math.round(itemData.quantity * itemData.unitPrice),
        }
        set((state) => ({
          workOrders: state.workOrders.map((wo) =>
            wo.id === workOrderId
              ? { ...wo, items: [...wo.items, item] }
              : wo
          ),
        }))
        get().recalculateTotals(workOrderId)
      },

      updateItem: (workOrderId, itemId, data) => {
        set((state) => ({
          workOrders: state.workOrders.map((wo) => {
            if (wo.id !== workOrderId) return wo
            const updatedItems = wo.items.map((item) => {
              if (item.id !== itemId) return item
              const updated = { ...item, ...data }
              updated.lineTotal = Math.round(updated.quantity * updated.unitPrice)
              return updated
            })
            return { ...wo, items: updatedItems }
          }),
        }))
        get().recalculateTotals(workOrderId)
      },

      removeItem: (workOrderId, itemId) => {
        set((state) => ({
          workOrders: state.workOrders.map((wo) =>
            wo.id === workOrderId
              ? { ...wo, items: wo.items.filter((item) => item.id !== itemId) }
              : wo
          ),
        }))
        get().recalculateTotals(workOrderId)
      },

      recalculateTotals: (workOrderId) => {
        const wo = get().workOrders.find((w) => w.id === workOrderId)
        if (!wo) return
        const totals = calculateTotals(wo.items, wo.discountAmount, wo.taxPercent)
        set((state) => ({
          workOrders: state.workOrders.map((w) =>
            w.id === workOrderId ? { ...w, ...totals } : w
          ),
        }))
      },

      setDiscount: (workOrderId, discountAmount) => {
        const wo = get().workOrders.find((w) => w.id === workOrderId)
        if (!wo) return
        const totals = calculateTotals(wo.items, discountAmount, wo.taxPercent)
        set((state) => ({
          workOrders: state.workOrders.map((w) =>
            w.id === workOrderId ? { ...w, ...totals } : w
          ),
        }))
      },

      setTaxPercent: (workOrderId, taxPercent) => {
        const wo = get().workOrders.find((w) => w.id === workOrderId)
        if (!wo) return
        // A rate above 100% (or below 0) is always a typo — clamp at the one
        // choke point every writer of taxPercent passes through.
        const clamped = Math.min(100, Math.max(0, taxPercent))
        const totals = calculateTotals(wo.items, wo.discountAmount, clamped)
        set((state) => ({
          workOrders: state.workOrders.map((w) =>
            w.id === workOrderId ? { ...w, taxPercent: clamped, ...totals } : w
          ),
        }))
      },
    }),
    {
      name: 'work-order-store',
      storage: createJSONStorage(getStorageAdapter),
      version: 2,
      // v1 -> v2: mileageIn split into odometerAtArrival (same value) and
      // odometerAtService (unset — nothing dishonestly backfilled).
      migrate: (persisted: any, version) => {
        if (version < 2) {
          persisted.workOrders = (persisted.workOrders ?? []).map((wo: any) => {
            const { mileageIn, ...rest } = wo
            return {
              ...rest,
              odometerAtArrival: mileageIn ?? null,
              odometerAtService: null,
            }
          })
        }
        return persisted
      },
    }
  )
)
