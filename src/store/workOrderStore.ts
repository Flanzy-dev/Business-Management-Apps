import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface WorkOrderItem {
  id: string
  description: string
  quantity: number
  unitPrice: number // whole Rupiah
  lineTotal: number // whole Rupiah
  productId?: string | null // set when the line came from an inventory product (drives stock auto-deduct on completion)
}

export interface WorkOrder {
  id: string
  orderNumber: number
  // References
  vehicleId: string
  workerId: string | null
  driverId: string | null // for fleet vehicles
  // Service info
  mileageIn: number | null
  date: string
  // Line items
  items: WorkOrderItem[]
  // Totals (all in whole Rupiah)
  subtotal: number
  discountPercent: number
  discountAmount: number
  taxPercent: number
  taxAmount: number
  total: number
  // Payment
  paymentMethod: 'cash' | 'card' | 'check' | 'pending'
  // Status
  status: 'open' | 'completed' | 'cancelled'
  notes: string
  createdAt: string
  completedAt: string | null
}

interface WorkOrderStore {
  workOrders: WorkOrder[]
  nextOrderNumber: number
  addWorkOrder: (data: Omit<WorkOrder, 'id' | 'orderNumber' | 'createdAt' | 'completedAt'>) => WorkOrder
  updateWorkOrder: (id: string, data: Partial<WorkOrder>) => void
  deleteWorkOrder: (id: string) => void
  getWorkOrder: (id: string) => WorkOrder | undefined
  getWorkOrdersByVehicle: (vehicleId: string) => WorkOrder[]
  completeWorkOrder: (id: string, paymentMethod: WorkOrder['paymentMethod']) => void
  cancelWorkOrder: (id: string) => void
  addItem: (workOrderId: string, item: Omit<WorkOrderItem, 'id' | 'lineTotal'>) => void
  updateItem: (workOrderId: string, itemId: string, data: Partial<WorkOrderItem>) => void
  removeItem: (workOrderId: string, itemId: string) => void
  recalculateTotals: (workOrderId: string) => void
}

function calculateTotals(items: WorkOrderItem[], discountPercent: number, taxPercent: number) {
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0)
  const discountAmount = Math.round(subtotal * (discountPercent / 100))
  const afterDiscount = subtotal - discountAmount
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
          ...data,
          id: crypto.randomUUID(),
          orderNumber,
          createdAt: new Date().toISOString(),
          completedAt: null,
        }
        set((state) => ({
          workOrders: [...state.workOrders, workOrder],
          nextOrderNumber: state.nextOrderNumber + 1,
        }))
        return workOrder
      },

      updateWorkOrder: (id, data) => {
        set((state) => ({
          workOrders: state.workOrders.map((wo) =>
            wo.id === id ? { ...wo, ...data } : wo
          ),
        }))
      },

      deleteWorkOrder: (id) => {
        set((state) => ({
          workOrders: state.workOrders.filter((wo) => wo.id !== id),
        }))
      },

      getWorkOrder: (id) => {
        return get().workOrders.find((wo) => wo.id === id)
      },

      getWorkOrdersByVehicle: (vehicleId) => {
        return get().workOrders.filter((wo) => wo.vehicleId === vehicleId)
      },

      completeWorkOrder: (id, paymentMethod) => {
        set((state) => ({
          workOrders: state.workOrders.map((wo) =>
            wo.id === id
              ? {
                  ...wo,
                  status: 'completed' as const,
                  paymentMethod,
                  completedAt: new Date().toISOString(),
                }
              : wo
          ),
        }))
      },

      cancelWorkOrder: (id) => {
        set((state) => ({
          workOrders: state.workOrders.map((wo) =>
            wo.id === id ? { ...wo, status: 'cancelled' as const } : wo
          ),
        }))
      },

      addItem: (workOrderId, itemData) => {
        const item: WorkOrderItem = {
          ...itemData,
          id: crypto.randomUUID(),
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
        const totals = calculateTotals(wo.items, wo.discountPercent, wo.taxPercent)
        set((state) => ({
          workOrders: state.workOrders.map((w) =>
            w.id === workOrderId ? { ...w, ...totals } : w
          ),
        }))
      },
    }),
    { name: 'work-order-store' }
  )
)
