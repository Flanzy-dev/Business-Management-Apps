// Who an order is for, now that an order does not always have a car.
//
// A counter sale — someone who only bought parts — carries an empty vehicleId.
// Its buyer, when the shop knows them, rides on the order itself
// (customerId/companyId); an order WITH a car is owned by the car's owner, as
// it always was. Everything that used to read "the vehicle's owner" for an
// order asks here instead, so the two shapes can't drift. Pure: callers pass
// their lists in.
import type { WorkOrder } from '../../store/workOrderStore'
import type { Vehicle } from '../../store/vehicleStore'
import type { Customer } from '../../store/customerStore'
import type { Company } from '../../store/companyStore'
import { translate } from '../i18n'
import { vehicleLabelWithPlate, ownerName } from '../format/entities'
import { findOwner, ownerOf, type OwnerRef } from '../vehicles/vehicleOwner'

type OrderRef = Pick<WorkOrder, 'vehicleId' | 'customerId' | 'companyId'>

/** An order with no car on it: parts sold over the counter. */
export function isCounterSale(order: Pick<WorkOrder, 'vehicleId'>): boolean {
  return !order.vehicleId
}

/** The order's owner: the car's owner when it has a car, else the buyer on the order. */
export function orderOwnerRef(order: OrderRef, vehicleById: ReadonlyMap<string, Vehicle>): OwnerRef | null {
  if (!isCounterSale(order)) return ownerOf(vehicleById.get(order.vehicleId))
  return ownerOf(order)
}

/**
 * Who to show as the customer. A counter sale with nobody named reads
 * "Walk-in" — a label for a person who really is anonymous, not the "Unknown"
 * a car whose owner went missing gets.
 */
export function orderOwnerName(
  order: OrderRef,
  vehicleById: ReadonlyMap<string, Vehicle>,
  customers: Customer[],
  companies: Company[]
): string {
  if (!isCounterSale(order)) return ownerName(vehicleById.get(order.vehicleId), customers, companies)
  const ref = ownerOf(order)
  if (!ref) return translate('workOrders.walkInCustomer')
  return findOwner(ref, { customers, companies })?.name ?? translate('appointments.unknownCustomer')
}

/** The phone/email to reach whoever the order is for, or null with nobody to reach. */
export function orderOwnerContact(
  order: OrderRef,
  vehicleById: ReadonlyMap<string, Vehicle>,
  customers: Customer[],
  companies: Company[]
): { phone: string; email: string } | null {
  const owner = findOwner(orderOwnerRef(order, vehicleById), { customers, companies })
  return owner ? { phone: owner.phone, email: owner.email } : null
}

/** The vehicle line of an order: the car, or "Counter sale" when there is none. */
export function orderVehicleLabel(order: Pick<WorkOrder, 'vehicleId'>, vehicle: Vehicle | undefined): string {
  return isCounterSale(order) ? translate('workOrders.counterSaleVehicle') : vehicleLabelWithPlate(vehicle)
}

/**
 * May this order be left unpaid? An invoice needs somebody to send it to: a
 * counter sale is settled on the spot unless it names a customer or company.
 * An order with a car always could — the car's owner is the debtor.
 */
export function canRecordUnpaid(order: OrderRef): boolean {
  return !isCounterSale(order) || ownerOf(order) !== null
}
