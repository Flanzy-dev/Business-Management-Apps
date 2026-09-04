import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { newEntity, updateById, removeById, findById } from './entityHelpers'
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
  /** The shop's own code for this item — what's printed on its shelf label. */
  sku: string
  /**
   * The code the *supplier's* price list gives this item — in this shop the
   * "modal" code, which encodes what the item cost. Stored uppercase (see
   * normalizeSupplierCode in src/lib/productIdentity.ts) and deliberately not
   * unique: anything bought at the same price carries the same code. Blank for
   * the many products no price list covered.
   */
  supplierCode: string
  category: string
  unit: string // 'each', 'liter', 'case', 'box', etc.
  costPrice: number // whole Rupiah
  sellPrice: number // whole Rupiah
  reorderPoint: number
  supplierId: string | null
  notes: string
  // Optional override of the vehicle-schedule item this product changes (see
  // src/lib/scheduleTagging.ts) — undefined/absent means "inherit from the
  // product's category", explicit null means "deliberately none, don't fall
  // back to the category". Optional key, not a migrated one — same convention
  // as ScheduleRule.intervalMonths (src/store/scheduleRuleStore.ts).
  serviceItemTypeId?: string | null
  createdAt: string
}

interface InventoryStore {
  products: Product[]
  addProduct: (product: Omit<Product, 'id' | 'createdAt'>) => Product
  addProducts: (products: Omit<Product, 'id' | 'createdAt'>[]) => Product[]
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

      // Bulk insert in one set() — a price-list import (src/lib/productImport.ts)
      // adds hundreds of products at once, and calling addProduct in a loop
      // would re-serialize the whole persisted blob once per product. One write
      // also means the sync tracker (src/lib/sync/tracker.ts) sees a single
      // diff carrying every new row instead of one op per set().
      addProducts: (list) => {
        const created = list.map((data) => newEntity(data))
        set((state) => ({ products: [...state.products, ...created] }))
        return created
      },

      updateProduct: (id, data) => {
        set((state) => ({ products: updateById(state.products, id, data) }))
      },

      deleteProduct: (id) => {
        set((state) => ({ products: removeById(state.products, id) }))
      },

      getProduct: (id) => {
        return findById(get().products, id)
      },

      getProductsByCategory: (category) => {
        return get().products.filter((p) => p.category === category)
      },

      getProductsBySupplier: (supplierId) => {
        return get().products.filter((p) => p.supplierId === supplierId)
      },
    }),
    {
      name: 'inventory-store',
      storage: createJSONStorage(getStorageAdapter),
      version: 1,
      // v0 -> v1: supplierCode added. Filled in as '' rather than left
      // undefined because the field is compared for uniqueness, sorted, and
      // written to CSV — every one of those sites would otherwise have to
      // defend against a missing key.
      migrate: (persisted: any, version) => {
        if (version < 1) {
          persisted.products = (persisted.products ?? []).map((p: any) => ({
            supplierCode: '',
            ...p,
          }))
        }
        return persisted
      },
    }
  )
)
