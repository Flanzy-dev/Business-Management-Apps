import { useMemo } from 'react'
import { useVehicleStore, Vehicle } from '../store/vehicleStore'
import { useCustomerStore } from '../store/customerStore'
import { useCompanyStore } from '../store/companyStore'
import type { WorkOrder } from '../store/workOrderStore'
import { ownerName } from '../lib/format/entities'
import { orderOwnerName } from '../lib/orders/orderOwner'

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
  /** The customer an order is for — its car's owner, or "Walk-in"/the named buyer on a counter sale. */
  orderOwnerNameFor: (order: Pick<WorkOrder, 'vehicleId' | 'customerId' | 'companyId'>) => string
} {
  const vehicles = useVehicleStore((s) => s.vehicles)
  const customers = useCustomerStore((s) => s.customers)
  const companies = useCompanyStore((s) => s.companies)
  const vehicleById = useMemo(() => new Map(vehicles.map((v) => [v.id, v])), [vehicles])

  return {
    vehicleById,
    ownerNameFor: (vehicleId) => ownerName(vehicleById.get(vehicleId), customers, companies),
    orderOwnerNameFor: (order) => orderOwnerName(order, vehicleById, customers, companies),
  }
}
