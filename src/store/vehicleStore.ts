import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { newEntity, updateById, removeById } from './entityHelpers'

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
}

interface VehicleStore {
  vehicles: Vehicle[]
  addVehicle: (vehicle: Omit<Vehicle, 'id' | 'createdAt'>) => Vehicle
  updateVehicle: (id: string, data: Partial<Vehicle>) => void
  deleteVehicle: (id: string) => void
  getVehicle: (id: string) => Vehicle | undefined
  getVehiclesByCustomer: (customerId: string) => Vehicle[]
  getVehiclesByCompany: (companyId: string) => Vehicle[]
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
    }),
    { name: 'vehicle-store' }
  )
)
