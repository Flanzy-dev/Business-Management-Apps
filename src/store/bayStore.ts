import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Bay {
  id: string
  name: string
  status: 'available' | 'in-service' | 'inspection' | 'awaiting-parts'
  currentWorkOrderId: string | null
  assignedWorkerId: string | null
  estimatedEndTime: string | null
  createdAt: string
  updatedAt: string
}

interface BayStore {
  bays: Bay[]
  addBay: (bay: Omit<Bay, 'id' | 'createdAt' | 'updatedAt'>) => Bay
  updateBay: (id: string, updates: Partial<Bay>) => void
  deleteBay: (id: string) => void
  assignWorkOrder: (bayId: string, workOrderId: string, workerId: string | null, estimatedMinutes: number) => void
  clearBay: (bayId: string) => void
  setStatus: (bayId: string, status: Bay['status']) => void
}

export const useBayStore = create<BayStore>()(
  persist(
    (set) => ({
      bays: [
        { id: '1', name: 'Bay 1', status: 'available', currentWorkOrderId: null, assignedWorkerId: null, estimatedEndTime: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: '2', name: 'Bay 2', status: 'available', currentWorkOrderId: null, assignedWorkerId: null, estimatedEndTime: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: '3', name: 'Bay 3', status: 'available', currentWorkOrderId: null, assignedWorkerId: null, estimatedEndTime: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: '4', name: 'Bay 4', status: 'available', currentWorkOrderId: null, assignedWorkerId: null, estimatedEndTime: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      ],

      addBay: (bayData) => {
        const bay: Bay = {
          ...bayData,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        set((state) => ({ bays: [...state.bays, bay] }))
        return bay
      },

      updateBay: (id, updates) => {
        set((state) => ({
          bays: state.bays.map((b) =>
            b.id === id ? { ...b, ...updates, updatedAt: new Date().toISOString() } : b
          ),
        }))
      },

      deleteBay: (id) => {
        set((state) => ({ bays: state.bays.filter((b) => b.id !== id) }))
      },

      assignWorkOrder: (bayId, workOrderId, workerId, estimatedMinutes) => {
        const estimatedEndTime = new Date(Date.now() + estimatedMinutes * 60000).toISOString()
        set((state) => ({
          bays: state.bays.map((b) =>
            b.id === bayId
              ? {
                  ...b,
                  status: 'in-service' as const,
                  currentWorkOrderId: workOrderId,
                  assignedWorkerId: workerId,
                  estimatedEndTime,
                  updatedAt: new Date().toISOString(),
                }
              : b
          ),
        }))
      },

      clearBay: (bayId) => {
        set((state) => ({
          bays: state.bays.map((b) =>
            b.id === bayId
              ? {
                  ...b,
                  status: 'available' as const,
                  currentWorkOrderId: null,
                  assignedWorkerId: null,
                  estimatedEndTime: null,
                  updatedAt: new Date().toISOString(),
                }
              : b
          ),
        }))
      },

      setStatus: (bayId, status) => {
        set((state) => ({
          bays: state.bays.map((b) =>
            b.id === bayId ? { ...b, status, updatedAt: new Date().toISOString() } : b
          ),
        }))
      },
    }),
    {
      name: 'bay-storage',
    }
  )
)
