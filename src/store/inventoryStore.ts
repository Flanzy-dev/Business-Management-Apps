import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Product {
  id: string
  name: string
  sku: string
  category: string
  unit: string // 'each', 'quart', 'gallon', etc.
  costPrice: number // cents
  sellPrice: number // cents
  qtyOnHand: number
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
  adjustStock: (id: string, quantity: number) => void // positive to add, negative to subtract
  getLowStockProducts: () => Product[]
  getProductsByCategory: (category: string) => Product[]
  getProductsBySupplier: (supplierId: string) => Product[]
}

export const useInventoryStore = create<InventoryStore>()(
  persist(
    (set, get) => ({
      products: [],

      addProduct: (data) => {
        const product: Product = {
          ...data,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
        }
        set((state) => ({ products: [...state.products, product] }))
        return product
      },

      updateProduct: (id, data) => {
        set((state) => ({
          products: state.products.map((p) =>
            p.id === id ? { ...p, ...data } : p
          ),
        }))
      },

      deleteProduct: (id) => {
        set((state) => ({
          products: state.products.filter((p) => p.id !== id),
        }))
      },

      getProduct: (id) => {
        return get().products.find((p) => p.id === id)
      },

      adjustStock: (id, quantity) => {
        set((state) => ({
          products: state.products.map((p) =>
            p.id === id ? { ...p, qtyOnHand: Math.max(0, p.qtyOnHand + quantity) } : p
          ),
        }))
      },

      getLowStockProducts: () => {
        return get().products.filter((p) => p.qtyOnHand <= p.reorderPoint)
      },

      getProductsByCategory: (category) => {
        return get().products.filter((p) => p.category === category)
      },

      getProductsBySupplier: (supplierId) => {
        return get().products.filter((p) => p.supplierId === supplierId)
      },
    }),
    { name: 'inventory-store' }
  )
)
