import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { newEntity, updateById, removeById, findById } from './entityHelpers'
import { seededId } from '../lib/id'
import { getStorageAdapter } from '../lib/storageAdapter'

export interface ServiceItemType {
  id: string
  name: string
  createdAt: string
}

// Fixed, not "now" — every fresh seed of this array must be byte-identical,
// see seededId's doc comment (lib/id.ts) for why a real timestamp here would
// defeat the point of the id being stable.
const SEED_CREATED_AT = '2020-01-01T00:00:00.000Z'

// Seeded once on first run; a shop's own renames/additions/removals (persisted
// to localStorage) take over after that. Downstream data (ScheduleRule,
// ServiceEvent, WorkOrderItem) always references these by id, never by name,
// so renaming one never breaks an existing link — which is exactly why these
// seed ids have to be deterministic (seededId), not newEntity's random ones:
// a store nobody has ever edited never gets a persist write (zustand only
// persists on a real mutation), so it reseeds from scratch on every launch,
// and a random id would silently orphan every existing reference each time.
const DEFAULT_SERVICE_ITEM_TYPES: ServiceItemType[] = [
  'Oli Mesin',
  'Filter Oli',
  'Oli Transmisi',
  'Oli Gardan',
  'Filter Solar',
  'Minyak Rem',
  'Minyak Power Steering',
].map((name) => ({ id: seededId('service-item-type', name), name, createdAt: SEED_CREATED_AT }))

interface ServiceItemTypeStore {
  serviceItemTypes: ServiceItemType[]
  addServiceItemType: (data: Omit<ServiceItemType, 'id' | 'createdAt'>) => ServiceItemType
  updateServiceItemType: (id: string, data: Partial<ServiceItemType>) => void
  deleteServiceItemType: (id: string) => void
  getServiceItemType: (id: string) => ServiceItemType | undefined
}

export const useServiceItemTypeStore = create<ServiceItemTypeStore>()(
  persist(
    (set, get) => ({
      serviceItemTypes: DEFAULT_SERVICE_ITEM_TYPES,

      addServiceItemType: (data) => {
        const serviceItemType = newEntity(data)
        set((state) => ({ serviceItemTypes: [...state.serviceItemTypes, serviceItemType] }))
        return serviceItemType
      },

      updateServiceItemType: (id, data) => {
        set((state) => ({ serviceItemTypes: updateById(state.serviceItemTypes, id, data) }))
      },

      deleteServiceItemType: (id) => {
        set((state) => ({ serviceItemTypes: removeById(state.serviceItemTypes, id) }))
      },

      getServiceItemType: (id) => {
        return findById(get().serviceItemTypes, id)
      },
    }),
    { name: 'service-item-type-store', storage: createJSONStorage(getStorageAdapter) }
  )
)
