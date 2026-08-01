import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { newEntity, updateById, removeById } from './entityHelpers'
import { getStorageAdapter } from '../lib/storageAdapter'

export interface ServiceItemType {
  id: string
  name: string
  createdAt: string
}

// Seeded once on first run; a shop's own renames/additions/removals (persisted
// to localStorage) take over after that. Downstream data (ScheduleRule,
// ServiceEvent, WorkOrderItem) always references these by id, never by name,
// so renaming one never breaks an existing link.
const DEFAULT_SERVICE_ITEM_TYPES: ServiceItemType[] = [
  'Oli Mesin',
  'Filter Oli',
  'Oli Transmisi',
  'Oli Gardan',
  'Filter Solar',
  'Minyak Rem',
  'Minyak Power Steering',
].map((name) => newEntity({ name }))

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
        return get().serviceItemTypes.find((t) => t.id === id)
      },
    }),
    { name: 'service-item-type-store', storage: createJSONStorage(getStorageAdapter) }
  )
)
