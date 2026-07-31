import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { newEntity, updateById, removeById } from './entityHelpers'
import { getStorageAdapter } from '../lib/storageAdapter'

export interface ProductCategory {
  id: string
  name: string
  createdAt: string
}

// Seeded once on first run; a shop's own renames/additions/removals (persisted
// to localStorage) take over after that. Product.category stores the plain
// name string (not this id) — categories, unlike ServiceItemType, are never
// renamed in a way that would break an existing link, so there's no need for
// products to reference them indirectly.
const DEFAULT_PRODUCT_CATEGORIES: ProductCategory[] = [
  'Oil',
  'Filter',
  'Fluid',
  'Parts',
  'Supplies',
  'Other',
].map((name) => newEntity({ name }))

interface ProductCategoryStore {
  categories: ProductCategory[]
  addProductCategory: (data: Omit<ProductCategory, 'id' | 'createdAt'>) => ProductCategory
  updateProductCategory: (id: string, data: Partial<ProductCategory>) => void
  deleteProductCategory: (id: string) => void
  getProductCategory: (id: string) => ProductCategory | undefined
}

export const useProductCategoryStore = create<ProductCategoryStore>()(
  persist(
    (set, get) => ({
      categories: DEFAULT_PRODUCT_CATEGORIES,

      addProductCategory: (data) => {
        const category = newEntity(data)
        set((state) => ({ categories: [...state.categories, category] }))
        return category
      },

      updateProductCategory: (id, data) => {
        set((state) => ({ categories: updateById(state.categories, id, data) }))
      },

      deleteProductCategory: (id) => {
        set((state) => ({ categories: removeById(state.categories, id) }))
      },

      getProductCategory: (id) => {
        return get().categories.find((c) => c.id === id)
      },
    }),
    { name: 'product-category-store', storage: createJSONStorage(getStorageAdapter) }
  )
)
