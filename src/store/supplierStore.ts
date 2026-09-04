import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { newEntity, updateById, removeById, findById } from './entityHelpers'
import { getStorageAdapter } from '../lib/storageAdapter'

export interface Supplier {
  id: string
  name: string
  phone: string
  email: string
  address: string
  notes: string
  createdAt: string
}

interface SupplierStore {
  suppliers: Supplier[]
  addSupplier: (supplier: Omit<Supplier, 'id' | 'createdAt'>) => Supplier
  updateSupplier: (id: string, data: Partial<Supplier>) => void
  deleteSupplier: (id: string) => void
  getSupplier: (id: string) => Supplier | undefined
}

export const useSupplierStore = create<SupplierStore>()(
  persist(
    (set, get) => ({
      suppliers: [],

      addSupplier: (data) => {
        const supplier = newEntity(data)
        set((state) => ({ suppliers: [...state.suppliers, supplier] }))
        return supplier
      },

      updateSupplier: (id, data) => {
        set((state) => ({ suppliers: updateById(state.suppliers, id, data) }))
      },

      deleteSupplier: (id) => {
        set((state) => ({ suppliers: removeById(state.suppliers, id) }))
      },

      getSupplier: (id) => {
        return findById(get().suppliers, id)
      },
    }),
    { name: 'supplier-store', storage: createJSONStorage(getStorageAdapter) }
  )
)
