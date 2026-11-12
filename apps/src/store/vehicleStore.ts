import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { newEntity, updateById, removeById, findById, withExclusiveFlag } from './entityHelpers'
import { getStorageAdapter } from '../lib/storage/storageAdapter'
import { ownerOf, ownerRefKey } from '../lib/vehicles/vehicleOwner'

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
  /** Bulk insert in one set(). Rows are taken as given — `isDefault` is not
   *  reconciled across siblings, so the caller sets at most one per owner. */
  addVehicles: (vehicles: Omit<Vehicle, 'id' | 'createdAt'>[]) => Vehicle[]
  updateVehicle: (id: string, data: Partial<Vehicle>) => void
  deleteVehicle: (id: string) => void
  /** Several at once, one set() — the losers of a vehicle merge. Unchecked:
   *  only src/lib/ops/vehicleMergeOps.ts calls it, after moving every reference. */
  deleteVehicles: (ids: string[]) => void
  getVehicle: (id: string) => Vehicle | undefined
  getVehiclesByCustomer: (customerId: string) => Vehicle[]
  getVehiclesByCompany: (companyId: string) => Vehicle[]
  /**
   * Marks one vehicle as its owner's default and clears the flag on every
   * other vehicle of that same owner in one pass — addVehicle/updateVehicle
   * alone can only ever touch a single vehicle, so this can't be expressed
   * with those (see companyStore.addDriver for the same bespoke-set pattern,
   * there for a nested array rather than a flag). Implemented via
   * entityHelpers.ts's withExclusiveFlag.
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

      addVehicles: (list) => {
        const created = list.map((data) => newEntity(data))
        set((state) => ({ vehicles: [...state.vehicles, ...created] }))
        return created
      },

      updateVehicle: (id, data) => {
        set((state) => ({ vehicles: updateById(state.vehicles, id, data) }))
      },

      deleteVehicle: (id) => {
        set((state) => ({ vehicles: removeById(state.vehicles, id) }))
      },

      deleteVehicles: (ids) => {
        const gone = new Set(ids)
        set((state) => ({ vehicles: state.vehicles.filter((v) => !gone.has(v.id)) }))
      },

      getVehicle: (id) => {
        return findById(get().vehicles, id)
      },

      getVehiclesByCustomer: (customerId) => {
        return get().vehicles.filter((v) => v.customerId === customerId)
      },

      getVehiclesByCompany: (companyId) => {
        return get().vehicles.filter((v) => v.companyId === companyId)
      },

      setDefaultVehicle: (vehicleId) => {
        set((state) => ({
          // Keyed by vehicleOwner.ts's owner key, so a customerId can never
          // coincidentally match a companyId; ownerless vehicles share one key.
          vehicles: withExclusiveFlag(
            state.vehicles,
            vehicleId,
            (v) => {
              const owner = ownerOf(v)
              return owner ? ownerRefKey(owner) : 'none'
            },
            'isDefault'
          ),
        }))
      },
    }),
    { name: 'vehicle-store', storage: createJSONStorage(getStorageAdapter) }
  )
)
