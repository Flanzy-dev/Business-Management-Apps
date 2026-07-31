import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { newEntity, updateById, removeById } from './entityHelpers'

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
        const worker = newEntity(data)
        set((state) => ({ workers: [...state.workers, worker] }))
        return worker
      },

      updateWorker: (id, data) => {
        set((state) => ({ workers: updateById(state.workers, id, data) }))
      },

      deleteWorker: (id) => {
        set((state) => ({ workers: removeById(state.workers, id) }))
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
