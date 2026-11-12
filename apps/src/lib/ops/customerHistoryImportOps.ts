// Applying a planned Excel-history import (src/lib/customers/customerHistoryImport.ts):
// customers/companies, their vehicles, and every logged visit as a completed,
// cash-paid work order.
//
// Everything is written with the stores' batch adders — one set() per store,
// so the ~170 owners, ~960 vehicles and ~2,000 orders of the real import reach
// SQLite and the sync tracker as four writes, not ~3,000.
//
// What it deliberately does NOT do, each for a reason:
// - No stock. Every line is free text (no productId), so nothing is deducted
//   and no FIFO lot is touched: this oil was sold years ago, out of stock the
//   app never knew about. The flip side, accepted by the shop: those orders
//   carry no cost of goods, so profit for the imported period reads high.
// - No schedule rules or service events. Seeded from visits years old, every
//   vehicle would land in Overdue Reminders at once; the shop sets a vehicle's
//   schedule when it next comes in.
// - No per-vehicle or per-order activity entries — one per owner is the
//   accountability trail; 3,000 more would bury the log.
import type { CustomerHistoryPlan, PlannedOwner } from '../customers/customerHistoryImport'
import type { Vehicle } from '../../store/vehicleStore'
import type { WorkOrder } from '../../store/workOrderStore'
import { newId } from '../format/id'
import { ownerFields } from '../vehicles/vehicleOwner'
import { computeOrderTotals } from '../orders/orderTotals'
import { createActivityOps } from './activityOps'
import { realOpsDeps, type OpsDeps } from './deps'

export type CustomerHistoryImportOpsDeps = Pick<
  OpsDeps,
  'customers' | 'companies' | 'vehicles' | 'workOrders' | 'activityLog' | 'mode'
>

export interface CustomerHistoryImportOutcome {
  customers: number
  companies: number
  vehicles: number
  orders: number
}

/**
 * A visit's YYYY-MM-DD as the ISO timestamp orders store, pinned to midday
 * local time: reports bucket by the date part, and midnight would slide a
 * visit into the previous day once converted to UTC (Indonesia is UTC+7).
 */
export function visitDateToIso(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0).toISOString()
}

export function createCustomerHistoryImportOps(deps: CustomerHistoryImportOpsDeps) {
  const { recordEntityChange } = createActivityOps(deps)

  function applyCustomerHistoryImport(plan: CustomerHistoryPlan): CustomerHistoryImportOutcome {
    const customerOwners = plan.create.filter((o) => o.ownerType === 'customer')
    const companyOwners = plan.create.filter((o) => o.ownerType === 'company')
    const imported = (o: PlannedOwner) => `Diimpor dari ${o.sourceFile}`

    const customers = deps.customers.getState().addCustomers(
      customerOwners.map((o) => ({ name: o.name, phone: o.phone, email: '', address: '', notes: imported(o) }))
    )
    const companies = deps.companies.getState().addCompanies(
      companyOwners.map((o) => ({
        companyName: o.name, contactPerson: '', phone: o.phone, email: '', billingAddress: '', notes: imported(o),
      }))
    )
    customers.forEach((c) => recordEntityChange('create', 'customer', c.id, c.name))
    companies.forEach((c) => recordEntityChange('create', 'company', c.id, c.companyName))

    // Pair each planned vehicle with its new owner's id, keeping the list
    // order so the created vehicles can be matched back by index.
    const ownerIds = new Map<PlannedOwner, { customerId: string | null; companyId: string | null }>()
    customerOwners.forEach((o, i) => ownerIds.set(o, ownerFields({ type: 'customer', id: customers[i].id })))
    companyOwners.forEach((o, i) => ownerIds.set(o, ownerFields({ type: 'company', id: companies[i].id })))

    // A planned vehicle whose plate the app already has only carries visits to
    // attach (vehicleIdentity.ts — never a second row for one plate); the rest
    // are created, the first new one per owner becoming its default.
    const planned = plan.create.flatMap((owner) => owner.vehicles.map((vehicle) => ({ owner, vehicle })))
    const toCreate = plan.create.flatMap((owner) =>
      owner.vehicles.filter((v) => !v.existingVehicleId).map((vehicle, i) => ({ owner, vehicle, first: i === 0 }))
    )
    const created = deps.vehicles.getState().addVehicles(
      toCreate.map(({ owner, vehicle, first }): Omit<Vehicle, 'id' | 'createdAt'> => ({
        ...ownerIds.get(owner)!,
        make: vehicle.make,
        model: '',
        year: null,
        vin: '',
        licensePlate: vehicle.plate,
        color: '',
        currentMileage: vehicle.currentMileage,
        engineType: '',
        engineSize: '',
        oilTypeRequired: vehicle.oilTypeRequired,
        oilCapacity: '',
        transmissionType: '',
        transmissionFluidType: vehicle.transmissionFluidType,
        driveType: '',
        differentialFluidType: vehicle.differentialFluidType,
        notes: vehicle.plate ? '' : 'No. polisi tidak tercatat di Excel',
        // One default per owner: the first vehicle their log names.
        isDefault: first,
      }))
    )

    const vehicleIdOf = new Map(planned.map(({ vehicle }) => [vehicle, vehicle.existingVehicleId] as const))
    toCreate.forEach(({ vehicle }, i) => vehicleIdOf.set(vehicle, created[i].id))

    // Oldest first, so order numbers run in the same direction as the dates.
    const visits = planned
      .flatMap(({ vehicle }) => vehicle.visits.map((visit) => ({ visit, vehicleId: vehicleIdOf.get(vehicle)! })))
      .sort((a, b) => a.visit.date.localeCompare(b.visit.date))
    const orders = deps.workOrders.getState().addWorkOrders(
      visits.map(({ visit, vehicleId }): Omit<WorkOrder, 'id' | 'orderNumber' | 'createdAt'> => {
        const at = visitDateToIso(visit.date)
        const items = visit.lines.map((line) => ({
          id: newId(),
          description: line.description,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          lineTotal: line.lineTotal,
          productId: null,
          kind: line.kind,
          quantityLiters: line.quantityLiters,
        }))
        // No discount or tax was recorded on the old logs.
        return {
          vehicleId,
          workerId: null,
          driverId: null,
          odometerAtArrival: visit.km,
          odometerAtService: visit.km,
          date: at,
          items,
          ...computeOrderTotals(items, 0, 0),
          taxPercent: 0,
          paymentMethod: 'cash',
          status: 'completed',
          notes: visit.notes,
          completedAt: at,
        }
      })
    )

    return { customers: customers.length, companies: companies.length, vehicles: created.length, orders: orders.length }
  }

  return { applyCustomerHistoryImport }
}

// The one real instance the running app uses.
const defaultOps = createCustomerHistoryImportOps(realOpsDeps)
export const applyCustomerHistoryImport = defaultOps.applyCustomerHistoryImport
