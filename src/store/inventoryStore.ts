import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { newEntity, updateById, removeById } from './entityHelpers'
import { getStorageAdapter } from '../lib/storageAdapter'

// Quantity on hand is deliberately not a field here — it's derived from the
// stock ledger (src/store/stockMovementStore.ts, src/lib/stockLedger.ts), never
// stored, so two devices drawing down the same product offline can never have
// one device's sale silently overwrite the other's. Read it via
// src/hooks/useProductStock.ts, which enriches a Product with its current
// qtyOnHand for display.
export interface Product {
  id: string
  name: string
  sku: string
  category: string
  unit: string // 'each', 'liter', 'case', 'box', etc.
  costPrice: number // whole Rupiah
  sellPrice: number // whole Rupiah
  reorderPoint: number
  supplierId: string | null
  notes: string
  createdAt: string
}

interface InventoryStore {
  products: Product[]
  addProduct: (product: Omit<Product, 'id' | 'createdAt'>) => Product
  updateProduct: (id: string, data: Partial<Product>) => void
  deleteProduct: (id: string) => void
  getProduct: (id: string) => Product | undefined
  getProductsByCategory: (category: string) => Product[]
  getProductsBySupplier: (supplierId: string) => Product[]
}

export const useInventoryStore = create<InventoryStore>()(
  persist(
    (set, get) => ({
      products: [],

      addProduct: (data) => {
        const product = newEntity(data)
        set((state) => ({ products: [...state.products, product] }))
        return product
      },

      updateProduct: (id, data) => {
        set((state) => ({ products: updateById(state.products, id, data) }))
      },

      deleteProduct: (id) => {
        set((state) => ({ products: removeById(state.products, id) }))
      },

      getProduct: (id) => {
        return get().products.find((p) => p.id === id)
      },

      getProductsByCategory: (category) => {
        return get().products.filter((p) => p.category === category)
      },

      getProductsBySupplier: (supplierId) => {
        return get().products.filter((p) => p.supplierId === supplierId)
      },
    }),
    { name: 'inventory-store', storage: createJSONStorage(getStorageAdapter) }
  )
)
