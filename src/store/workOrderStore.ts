import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { newEntity, updateById, removeById } from './entityHelpers'
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
}

function calculateTotals(items: WorkOrderItem[], discountAmount: number, taxPercent: number) {
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0)
  const afterDiscount = Math.max(0, subtotal - discountAmount)
  const taxAmount = Math.round(afterDiscount * (taxPercent / 100))
  const total = afterDiscount + taxAmount
  return { subtotal, discountAmount, taxAmount, total }
}

export const useWorkOrderStore = create<WorkOrderStore>()(
  persist(
    (set, get) => ({
      workOrders: [],
      nextOrderNumber: 1001,

      addWorkOrder: (data) => {
        const orderNumber = get().nextOrderNumber
        const workOrder: WorkOrder = {
          ...newEntity(data),
          orderNumber,
          completedAt: null,
        }
        set((state) => ({
          workOrders: [...state.workOrders, workOrder],
          nextOrderNumber: state.nextOrderNumber + 1,
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
        return get().workOrders.find((wo) => wo.id === id)
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
