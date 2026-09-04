import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { newEntity, updateById, removeById, findById } from './entityHelpers'
import { getStorageAdapter } from '../lib/storageAdapter'

/**
 * A job the shop charges for (labor), as opposed to a part it sells — the
 * price-list counterpart to inventory Product. Kept as its own entity rather
 * than a Product with a "Service" category because a work-order line's
 * `productId` is what splits parts revenue from labor revenue in
 * src/lib/finance.ts and Products from Services on the receipt
 * (src/lib/orderItemGroups.ts): a service must never carry one.
 */
export interface ServiceCatalogItem {
  id: string
  name: string
  price: number // whole Rupiah, same integer convention as Product.sellPrice
  // Optional link to the vehicle-schedule taxonomy — set it and adding this
  // service tags the line as a "changed" service item, so the job feeds the
  // vehicle's due-service schedule without the tech ticking anything.
  serviceItemTypeId: string | null
  // Default reminder interval — shop-wide, not vehicle-specific (contrast
  // ScheduleRule.intervalKm, which is per vehicle+item-type). Either or both
  // may be set; whichever threshold a vehicle reaches first is "due". Both
  // optional (not `| null`) because this store isn't versioned/migrated —
  // existing persisted rows simply won't have the key, same convention as
  // WorkOrderItem.costOfGoods (src/store/workOrderStore.ts).
  intervalKm?: number | null
  intervalMonths?: number | null
  notes: string
  createdAt: string
}

interface ServiceCatalogStore {
  services: ServiceCatalogItem[]
  addService: (data: Omit<ServiceCatalogItem, 'id' | 'createdAt'>) => ServiceCatalogItem
  updateService: (id: string, data: Partial<ServiceCatalogItem>) => void
  deleteService: (id: string) => void
  getService: (id: string) => ServiceCatalogItem | undefined
}

// Deliberately unseeded, unlike ProductCategory/ServiceItemType: those seed
// names only, and a service is nothing without a price — seeding one would put
// a number the shop never agreed to onto a real ticket.
//
// Deletion needs no blocker (contrast serviceItemTypeDeletionBlocker in
// src/lib/deletionPolicy.ts): a work-order line copies the service's name,
// price and tag at the moment it's added and never references this entry
// afterwards, so removing one can't orphan an existing order.
export const useServiceCatalogStore = create<ServiceCatalogStore>()(
  persist(
    (set, get) => ({
      services: [],

      addService: (data) => {
        const service = newEntity(data)
        set((state) => ({ services: [...state.services, service] }))
        return service
      },

      updateService: (id, data) => {
        set((state) => ({ services: updateById(state.services, id, data) }))
      },

      deleteService: (id) => {
        set((state) => ({ services: removeById(state.services, id) }))
      },

      getService: (id) => {
        return findById(get().services, id)
      },
    }),
    { name: 'service-catalog-store', storage: createJSONStorage(getStorageAdapter) }
  )
)
