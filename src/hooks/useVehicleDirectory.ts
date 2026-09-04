import { useMemo } from 'react'
import { useVehicleStore, Vehicle } from '../store/vehicleStore'
import { useCustomerStore } from '../store/customerStore'
import { useCompanyStore } from '../store/companyStore'
import { ownerName } from '../lib/entities'

/**
 * The vehicle-id -> {vehicle, owner name} lookup WorkOrderList.tsx, Reminders,
 * and Dashboard each built by hand: `new Map(vehicles.map(...))` plus a
 * customers/companies-backed ownerName wrapper. Deliberately doesn't also
 * bundle a vehicle-label formatter — callers disagree on which one they want
 * (`vehicleLabel` vs `vehicleLabelWithPlate`), so that stays their own call
 * against the returned `vehicleById`.
 */
export function useVehicleDirectory(): {
  vehicleById: Map<string, Vehicle>
  ownerNameFor: (vehicleId: string) => string
} {
  const vehicles = useVehicleStore((s) => s.vehicles)
  const customers = useCustomerStore((s) => s.customers)
  const companies = useCompanyStore((s) => s.companies)
  const vehicleById = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles])

  return {
    vehicleById,
    ownerNameFor: (vehicleId) => ownerName(vehicleById.get(vehicleId), customers, companies),
  }
}
