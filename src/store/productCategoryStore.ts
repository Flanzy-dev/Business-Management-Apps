import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { newEntity, updateById, removeById, findById } from './entityHelpers'
import { seededId } from '../lib/id'
import { getStorageAdapter } from '../lib/storageAdapter'

export interface ProductCategory {
  id: string
  name: string
  // The vehicle-schedule item every product in this category changes (see
  // src/lib/scheduleTagging.ts) — e.g. an oil category tagged with "Oli
  // Mesin" so every product in it advances the same schedule without being
  // tagged one at a time. undefined/absent falls back to the built-in
  // default for a seeded category name (or none for a shop's own category);
  // explicit null means "deliberately none, don't guess." Optional key, not
  // migrated — same convention as ScheduleRule.intervalMonths.
  serviceItemTypeId?: string | null
  createdAt: string
}

// Fixed, not "now" — every fresh seed of this array must be byte-identical,
// see seededId's doc comment (lib/id.ts) for why a real timestamp here would
// defeat the point of the id being stable.
const SEED_CREATED_AT = '2020-01-01T00:00:00.000Z'

// Seeded once on first run; a shop's own renames/additions/removals (persisted
// to localStorage) take over after that. Product.category stores the plain
// name string (not this id), so nothing downstream breaks the way
// ScheduleRule.itemTypeId does when ServiceItemType ids churn — but this
// store reseeds from scratch on every launch just the same (zustand's
// persist only writes on a real mutation, and nobody edits the built-in
// seven most of the time), and a LAN-synced shop merges rows by id: two
// devices that each reseed their own random id for "Gemuk" and then sync end
// up with two "Gemuk" rows. seededId (lib/id.ts) makes every device's fresh
// seed agree, same reasoning as serviceItemTypeStore.ts.
const DEFAULT_PRODUCT_CATEGORIES: ProductCategory[] = [
  'Oli Mesin Diesel',
  'Oli Mesin Bensin',
  'Oli Mesin Motor / Matic',
  'Oli Transmisi / Gardan',
  'Gemuk',
  'Pendingin & Minyak Rem',
  'Additive / Pembersih',
].map((name) => ({ id: seededId('product-category', name), name, createdAt: SEED_CREATED_AT }))

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
        return findById(get().categories, id)
      },
    }),
    {
      name: 'product-category-store',
      storage: createJSONStorage(getStorageAdapter),
      version: 3,
      // v0 -> v1: the six generic English defaults were replaced by the
      // shop's own seven. v1 -> v2: those seven were reworded (e.g. "Oli
      // Diesel" -> "Oli Mesin Diesel"). v2 -> v3: "&" swapped for "/" in
      // three of them (e.g. "Oli Mesin Motor & Matic" -> "Oli Mesin Motor /
      // Matic"). Every step only swaps a list that's still *exactly* the
      // prior defaults — a shop that renamed/added/removed anything keeps
      // what it has.
      migrate: (persisted: any, version) => {
        const namesOf = (list: any[]) => (list ?? []).map((c: any) => c.name)
        const isExactly = (list: any[], names: string[]) => {
          const actual = namesOf(list)
          return actual.length === names.length && names.every((n, i) => actual[i] === n)
        }
        if (version < 1) {
          const OLD = ['Oil', 'Filter', 'Fluid', 'Parts', 'Supplies', 'Other']
          if (isExactly(persisted.categories, OLD)) {
            persisted.categories = DEFAULT_PRODUCT_CATEGORIES
          }
        }
        if (version < 2) {
          const V1 = [
            'Oli Diesel', 'Oli Bensin', 'Oli Motor/Matic', 'Oli Transmisi / Gardan',
            'Gemuk / Grease', 'Coolant & Brake Fluid', 'Chemical / Additive',
          ]
          if (isExactly(persisted.categories, V1)) {
            persisted.categories = DEFAULT_PRODUCT_CATEGORIES
          }
        }
        if (version < 3) {
          const V2 = [
            'Oli Mesin Diesel', 'Oli Mesin Bensin', 'Oli Mesin Motor & Matic', 'Oli Transmisi & Gardan',
            'Gemuk', 'Pendingin & Minyak Rem', 'Additive & Pembersih',
          ]
          if (isExactly(persisted.categories, V2)) {
            persisted.categories = DEFAULT_PRODUCT_CATEGORIES
          }
        }
        return persisted
      },
    }
  )
)
