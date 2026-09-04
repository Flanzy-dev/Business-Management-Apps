import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { newEntity, removeById, findById } from './entityHelpers'
import { getStorageAdapter } from '../lib/storageAdapter'

export type ContainerType = 'bottle' | 'drum' | 'gallon' // Botol / Drum / Galon

export interface ServiceEventItem {
  id: string
  itemTypeId: string
  action: 'changed' | 'topped_up' // only 'changed' moves a ScheduleRule's base
  quantityLiters: number | null
  containerType: ContainerType | null // what the oil/fluid was dispensed from
  notes: string
}

export interface ServiceEvent {
  id: string
  vehicleId: string
  workOrderId: string | null // the WorkOrder this was generated from
  date: string
  odometerAtArrival: number | null
  odometerAtService: number | null
  items: ServiceEventItem[]
  notes: string
  createdAt: string
}

interface ServiceEventStore {
  serviceEvents: ServiceEvent[]
  addServiceEvent: (data: Omit<ServiceEvent, 'id' | 'createdAt'>) => ServiceEvent
  deleteServiceEvent: (id: string) => void
  deleteServiceEventsByWorkOrder: (workOrderId: string) => void
  getServiceEvent: (id: string) => ServiceEvent | undefined
  getServiceEventsByVehicle: (vehicleId: string) => ServiceEvent[]
}

export const useServiceEventStore = create<ServiceEventStore>()(
  persist(
    (set, get) => ({
      serviceEvents: [],

      addServiceEvent: (data) => {
        const serviceEvent = newEntity(data)
        set((state) => ({ serviceEvents: [...state.serviceEvents, serviceEvent] }))
        return serviceEvent
      },

      deleteServiceEvent: (id) => {
        set((state) => ({ serviceEvents: removeById(state.serviceEvents, id) }))
      },

      deleteServiceEventsByWorkOrder: (workOrderId) => {
        set((state) => ({
          serviceEvents: state.serviceEvents.filter((e) => e.workOrderId !== workOrderId),
        }))
      },

      getServiceEvent: (id) => {
        return findById(get().serviceEvents, id)
      },

      getServiceEventsByVehicle: (vehicleId) => {
        return get().serviceEvents.filter((e) => e.vehicleId === vehicleId)
      },
    }),
    { name: 'service-event-store', storage: createJSONStorage(getStorageAdapter) }
  )
)
