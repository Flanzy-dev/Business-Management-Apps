import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { getStorageAdapter } from '../lib/storageAdapter'
import { newId } from '../lib/id'
import { touchById, removeById } from './entityHelpers'

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
  /** `estimatedEndTime` is a precomputed ISO timestamp, not a minutes count —
   *  see src/lib/bayAssignment.ts's estimatedEnd, which the ops layer uses to
   *  compute it from its own injected `now()` rather than this store reaching
   *  for Date.now() itself. */
  assignWorkOrder: (bayId: string, workOrderId: string, workerId: string | null, estimatedEndTime: string) => void
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
          id: newId(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        set((state) => ({ bays: [...state.bays, bay] }))
        return bay
      },

      updateBay: (id, updates) => {
        set((state) => ({ bays: touchById(state.bays, id, updates) }))
      },

      deleteBay: (id) => {
        set((state) => ({ bays: removeById(state.bays, id) }))
      },

      assignWorkOrder: (bayId, workOrderId, workerId, estimatedEndTime) => {
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
        set((state) => ({ bays: touchById(state.bays, bayId, { status }) }))
      },
    }),
    {
      name: 'bay-storage',
      storage: createJSONStorage(getStorageAdapter),
    }
  )
)
