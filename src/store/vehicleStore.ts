import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { newEntity, updateById, removeById } from './entityHelpers'
import { getStorageAdapter } from '../lib/storageAdapter'

export interface Vehicle {
  id: string
  // Ownership - either customer or company, not both
  customerId: string | null
  companyId: string | null
  // Basic info
  make: string
  model: string
  year: number | null
  vin: string
  licensePlate: string
  color: string
  currentMileage: number | null
  // Engine info
  engineType: string
  engineSize: string
  oilTypeRequired: string
  oilCapacity: string
  // Transmission info
  transmissionType: string
  transmissionFluidType: string
  // Gardan / Differential info
  driveType: string
  differentialFluidType: string
  // Meta
  notes: string
  createdAt: string
  // At most one true per owner (customerId or companyId) — enforced by
  // setDefaultVehicle below, not by this field alone. Optional (not a
  // required boolean) because this store isn't versioned/migrated —
  // existing persisted rows simply won't have the key, same convention as
  // ServiceCatalogItem.intervalKm (src/store/serviceCatalogStore.ts).
  // Undefined means "no default set for this owner yet", same as false.
  isDefault?: boolean
}

interface VehicleStore {
  vehicles: Vehicle[]
  addVehicle: (vehicle: Omit<Vehicle, 'id' | 'createdAt'>) => Vehicle
  updateVehicle: (id: string, data: Partial<Vehicle>) => void
  deleteVehicle: (id: string) => void
  getVehicle: (id: string) => Vehicle | undefined
  getVehiclesByCustomer: (customerId: string) => Vehicle[]
  getVehiclesByCompany: (companyId: string) => Vehicle[]
  /**
   * Marks one vehicle as its owner's default and clears the flag on every
   * other vehicle of that same owner in one pass — addVehicle/updateVehicle
   * alone can only ever touch a single vehicle, so this can't be expressed
   * with those (see companyStore.addDriver for the same bespoke-set pattern).
   */
  setDefaultVehicle: (vehicleId: string) => void
}

export const useVehicleStore = create<VehicleStore>()(
  persist(
    (set, get) => ({
      vehicles: [],

      addVehicle: (data) => {
        const vehicle = newEntity(data)
        set((state) => ({ vehicles: [...state.vehicles, vehicle] }))
        return vehicle
      },

      updateVehicle: (id, data) => {
        set((state) => ({ vehicles: updateById(state.vehicles, id, data) }))
      },

      deleteVehicle: (id) => {
        set((state) => ({ vehicles: removeById(state.vehicles, id) }))
      },

      getVehicle: (id) => {
        return get().vehicles.find((v) => v.id === id)
      },

      getVehiclesByCustomer: (customerId) => {
        return get().vehicles.filter((v) => v.customerId === customerId)
      },

      getVehiclesByCompany: (companyId) => {
        return get().vehicles.filter((v) => v.companyId === companyId)
      },

      setDefaultVehicle: (vehicleId) => {
        set((state) => {
          const target = state.vehicles.find((v) => v.id === vehicleId)
          if (!target) return state
          return {
            vehicles: state.vehicles.map((v) => {
              const sameOwner = target.customerId
                ? v.customerId === target.customerId
                : v.companyId === target.companyId
              return sameOwner ? { ...v, isDefault: v.id === vehicleId } : v
            }),
          }
        })
      },
    }),
    { name: 'vehicle-store', storage: createJSONStorage(getStorageAdapter) }
  )
)
