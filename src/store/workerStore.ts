import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Worker {
  id: string
  name: string
  phone: string
  employeeId: string
  hireDate: string
  isActive: boolean
  notes: string
  createdAt: string
}

interface WorkerStore {
  workers: Worker[]
  addWorker: (worker: Omit<Worker, 'id' | 'createdAt'>) => Worker
  updateWorker: (id: string, data: Partial<Worker>) => void
  deleteWorker: (id: string) => void
  getWorker: (id: string) => Worker | undefined
  getActiveWorkers: () => Worker[]
}

export const useWorkerStore = create<WorkerStore>()(
  persist(
    (set, get) => ({
      workers: [],

      addWorker: (data) => {
        const worker: Worker = {
          ...data,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
        }
        set((state) => ({ workers: [...state.workers, worker] }))
        return worker
      },

      updateWorker: (id, data) => {
        set((state) => ({
          workers: state.workers.map((w) =>
            w.id === id ? { ...w, ...data } : w
          ),
        }))
      },

      deleteWorker: (id) => {
        set((state) => ({
          workers: state.workers.filter((w) => w.id !== id),
        }))
      },

      getWorker: (id) => {
        return get().workers.find((w) => w.id === id)
      },

      getActiveWorkers: () => {
        return get().workers.filter((w) => w.isActive)
      },
    }),
    { name: 'worker-store' }
  )
)
