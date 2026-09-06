import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { newEntity, updateById, removeById, findById } from './entityHelpers'
import { seededId } from '../lib/id'
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
  /** Bulk insert in one set() — src/lib/serviceImport.ts's CSV import can add
   *  dozens at once, and calling addService in a loop would re-serialize the
   *  whole persisted blob once per row and give the sync tracker one op per
   *  row instead of one op for the batch. Same reasoning, same shape, as
   *  src/store/inventoryStore.ts's addProducts. */
  addServices: (list: Omit<ServiceCatalogItem, 'id' | 'createdAt'>[]) => ServiceCatalogItem[]
  updateService: (id: string, data: Partial<ServiceCatalogItem>) => void
  deleteService: (id: string) => void
  getService: (id: string) => ServiceCatalogItem | undefined
}

// Fixed, not "now" — every fresh seed of this array must be byte-identical
// across devices; see seededId's doc (lib/id.ts) and productCategoryStore.ts's
// own SEED_CREATED_AT for why a real timestamp here would defeat that.
const SEED_CREATED_AT = '2020-01-01T00:00:00.000Z'

// Seven oil-change-shop labor jobs, seeded at price 0 so the shop still has
// to agree to a real number before one can reach a ticket — the actual
// concern the store used to be unseeded over (see the removed header note,
// preserved below). What seeding buys: names, schedule tags and km/month
// intervals, which is what seedDefaultScheduleRules/seedScheduleRulesFromServices
// (src/lib/ops/scheduleOps.ts) need to populate the Add Vehicle "Workshop
// Default" checklist — dead on every fresh install while this list was empty.
//
// Exactly one service per serviceItemTypeId is load-bearing, not stylistic:
// resolveDefaultCatalogMatch (src/lib/serviceCatalog.ts) refuses to guess the
// moment a tag has two candidates carrying an interval, which would silently
// disable auto-fill for that tag. Don't add a second variant (e.g. "Sintetik")
// for any of these seven without also removing or re-tagging the others.
//
// itemTypeId is resolved via seededId, matching serviceItemTypeStore.ts's own
// seeded ids by construction (both derive from the identical
// seededId('service-item-type', name) call) — not a hardcoded id, so this
// still works if that store's seeding logic ever changes shape.
const itemTypeId = (name: string) => seededId('service-item-type', name)

const DEFAULT_SERVICES: ServiceCatalogItem[] = (
  [
    { name: 'Ganti Oli Mesin', serviceItemTypeId: itemTypeId('Oli Mesin'), intervalKm: 5000, intervalMonths: 4 },
    { name: 'Ganti Filter Oli', serviceItemTypeId: itemTypeId('Filter Oli'), intervalKm: 10000, intervalMonths: null },
    { name: 'Ganti Oli Transmisi', serviceItemTypeId: itemTypeId('Oli Transmisi'), intervalKm: 40000, intervalMonths: null },
    { name: 'Ganti Oli Gardan', serviceItemTypeId: itemTypeId('Oli Gardan'), intervalKm: 40000, intervalMonths: null },
    { name: 'Ganti Filter Solar', serviceItemTypeId: itemTypeId('Filter Solar'), intervalKm: 20000, intervalMonths: null },
    { name: 'Ganti Minyak Rem', serviceItemTypeId: itemTypeId('Minyak Rem'), intervalKm: null, intervalMonths: 24 },
    {
      name: 'Ganti Minyak Power Steering',
      serviceItemTypeId: itemTypeId('Minyak Power Steering'),
      intervalKm: 40000,
      intervalMonths: 24,
    },
  ] satisfies Omit<ServiceCatalogItem, 'id' | 'createdAt' | 'price' | 'notes'>[]
).map((s) => ({ id: seededId('service-catalog', s.name), price: 0, notes: '', createdAt: SEED_CREATED_AT, ...s }))

// Deletion needs no blocker (contrast serviceItemTypeDeletionBlocker in
// src/lib/deletionPolicy.ts): a work-order line copies the service's name,
// price and tag at the moment it's added and never references this entry
// afterwards, so removing one can't orphan an existing order.
export const useServiceCatalogStore = create<ServiceCatalogStore>()(
  persist(
    (set, get) => ({
      services: DEFAULT_SERVICES,

      addService: (data) => {
        const service = newEntity(data)
        set((state) => ({ services: [...state.services, service] }))
        return service
      },

      addServices: (list) => {
        const created = list.map((data) => newEntity(data))
        set((state) => ({ services: [...state.services, ...created] }))
        return created
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
