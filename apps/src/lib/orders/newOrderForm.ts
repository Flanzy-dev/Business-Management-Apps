// The New Work Order dialog's own rules, pulled out of the component that
// renders it (src/components/workOrders/NewWorkOrderDialog.tsx) — same
// "real rules belong in a plain .ts, not a component body" reasoning as
// vehicleForm.ts. This file holds the two largest non-JSX blocks that dialog
// had: the Quick Find search (a single-pass scan across every vehicle,
// matching plate/VIN/owner name at once) and the final draft-to-payload
// mapping for addWorkOrder.
import type { Vehicle } from '../../store/vehicleStore'
import type { Customer } from '../../store/customerStore'
import type { Company } from '../../store/companyStore'
import type { WorkOrder } from '../../store/workOrderStore'
import { plateKey } from '../vehicles/vehicleIdentity'
import { ownerFields, ownerOf } from '../vehicles/vehicleOwner'
import { orderLabel } from '../format/entities'
import { vehicleMatch } from '../format/entitySearch'

export interface QuickFindResult {
  vehicleId: string
  ownerType: 'customer' | 'company'
  ownerId: string
  plate: string
  vehicleLabel: string
  ownerLabel: string
}

/**
 * How well a vehicle matches what was typed — lower is better, null is no match.
 * A counter hand types a whole plate and expects THAT car first, not whichever
 * of six earlier owners happened to contain the same letters.
 */
function matchRank(vehicle: Vehicle, ownerLabel: string, ownerPhone: string, q: string): number | null {
  const typedPlate = plateKey(q)
  if (typedPlate) {
    const plate = plateKey(vehicle.licensePlate)
    if (plate === typedPlate) return 0
    if (plate.startsWith(typedPlate)) return 1
    // Staff usually type just the digits. "1234" starts the number segment of
    // "B 1234 XYZ" — a far likelier hit than "1234" buried inside "D 91234 AB".
    const segments = (vehicle.licensePlate ?? '').toUpperCase().split(/\s+/)
    if (segments.some((segment) => segment.startsWith(typedPlate))) return 2
    if (plate.includes(typedPlate)) return 3
  }
  if (vehicle.vin?.toLowerCase().includes(q)) return 4
  const owner = ownerLabel.toLowerCase()
  if (owner.startsWith(q)) return 5
  if (owner.includes(q)) return 6

  // Words in any order, over everything we know about the car and its owner:
  // "budi 1234" (owner + plate digits), "santoso avanza", an owner's phone
  // number. Exact words rank above a near-miss spelling ("santosa").
  const kind = vehicleMatch(vehicle, q, `${ownerLabel} ${ownerPhone}`)
  if (kind === 'exact') return 7
  if (kind === 'fuzzy') return 8
  return null
}

/**
 * Vehicles (with their resolved owner) matching `query` against plate, VIN,
 * or owner name — whichever a returning customer is more likely to recall
 * than which owner record their car is filed under. Best match first (see
 * matchRank), capped at `limit`: this feeds a dropdown, not a full results
 * page. An owner-less vehicle, or one whose owner record has since been
 * deleted, is silently excluded — Quick Find can't hand off to a picker that
 * has nothing to pick.
 *
 * Owners are looked up through maps built once per call: this runs on every
 * keystroke over every vehicle, and a linear owner search per vehicle made
 * each key press O(vehicles × owners).
 */
export function quickFindVehicles(
  query: string,
  vehicles: Vehicle[],
  customers: Customer[],
  companies: Company[],
  noPlateLabel: string,
  limit = 6
): QuickFindResult[] {
  const q = query.trim().toLowerCase()
  if (q.length < 2) return []

  const customerNames = new Map(customers.map((c) => [c.id, c.name]))
  const companyNames = new Map(companies.map((c) => [c.id, c.companyName]))
  const customerPhones = new Map(customers.map((c) => [c.id, c.phone]))
  const companyPhones = new Map(companies.map((c) => [c.id, c.phone]))

  const ranked: { rank: number; result: QuickFindResult }[] = []
  for (const v of vehicles) {
    const ref = ownerOf(v)
    if (!ref) continue
    const ownerLabel = (ref.type === 'customer' ? customerNames : companyNames).get(ref.id)
    if (!ownerLabel) continue
    const ownerPhone = (ref.type === 'customer' ? customerPhones : companyPhones).get(ref.id) ?? ''

    const rank = matchRank(v, ownerLabel, ownerPhone, q)
    if (rank === null) continue
    ranked.push({
      rank,
      result: {
        ownerType: ref.type,
        ownerId: ref.id,
        vehicleId: v.id,
        plate: v.licensePlate || noPlateLabel,
        vehicleLabel: `${v.year ?? ''} ${v.make} ${v.model}`.trim(),
        ownerLabel,
      },
    })
  }
  // Array.prototype.sort is stable, so equal ranks keep the vehicle list's order.
  return ranked.sort((a, b) => a.rank - b.rank).slice(0, limit).map((r) => r.result)
}

/**
 * The vehicle's order that is still open, if any — the newest when several are.
 * A car already on the lift usually means someone is about to open a second
 * ticket for it by mistake (two people at the counter, a customer who came back
 * to add something). It is a warning, not a block: two separate jobs on one car
 * in a day are legitimate.
 */
export function openOrderForVehicle<T extends Pick<WorkOrder, 'vehicleId' | 'status' | 'createdAt'>>(
  orders: readonly T[],
  vehicleId: string
): T | undefined {
  if (!vehicleId) return undefined
  let newest: T | undefined
  for (const order of orders) {
    if (order.vehicleId !== vehicleId || order.status !== 'open') continue
    if (!newest || order.createdAt > newest.createdAt) newest = order
  }
  return newest
}

export interface NewOrderDraft {
  /** Empty for a counter sale (parts only, no car). */
  vehicleId: string
  /** The buyer of a counter sale, when named — ignored when there is a vehicle,
   *  whose owner is the customer. At most one of the two is used (customer wins). */
  customerId?: string
  companyId?: string
  workerId: string
  driverId: string
  /** Text, same as every other numeric field in this codebase's *Draft shapes. */
  odometer: string
  notes: string
}

/**
 * The addWorkOrder payload for a brand-new order. `currentMileage` is the
 * selected vehicle's own reading, used only as the odometer fallback when
 * staff left the field blank at the gate — it's never itself the recorded
 * value once the field has real text in it.
 */
/**
 * The "order created" toast, same shape scheduleSeedToast (vehicleForm.ts)
 * uses for the sibling "vehicle created" toast — `overdueAddedCount` is 0 for
 * every order except one started from an Overdue Reminders row, in which
 * case the description also says how many overdue lines came with it (see
 * NewWorkOrderDialog.tsx's handleCreate).
 */
export function orderCreatedToast(
  orderNumber: number,
  overdueAddedCount: number,
  t: (key: string, vars?: Record<string, string | number>) => string,
  tc: (key: string, count: number, vars?: Record<string, string | number>) => string,
  orderNumberSuffix?: string
): { tone: 'success'; title: string; description: string } {
  const order = orderLabel(orderNumber, orderNumberSuffix)
  return {
    tone: 'success',
    title: t('workOrders.orderCreatedTitle'),
    description:
      overdueAddedCount > 0
        ? tc('workOrders.overdueAutoAddedDescription', overdueAddedCount, { order })
        : t('workOrders.orderCreatedDescription', { order }),
  }
}

export function newOrderDraftToData(
  draft: NewOrderDraft,
  taxRate: number,
  currentMileage: number | null
): Omit<WorkOrder, 'id' | 'orderNumber' | 'createdAt' | 'completedAt'> {
  const counterSale = !draft.vehicleId
  return {
    vehicleId: draft.vehicleId,
    // Only a counter sale carries its buyer on the order; with a car the car's
    // owner is the customer, so these keys are left off entirely.
    ...(counterSale ? ownerFields(ownerOf(draft)) : {}),
    workerId: draft.workerId || null,
    // No car, so no fleet driver and no odometer — whatever was typed before the
    // vehicle was cleared must not leak onto the sale.
    driverId: counterSale ? null : draft.driverId || null,
    // The reading staff typed at the gate — falling back to today's silent
    // snapshot only when the field was left blank. It only moves again once
    // the tech records Odometer at Service (see the editor view).
    odometerAtArrival: counterSale ? null : draft.odometer.trim() ? parseInt(draft.odometer, 10) : currentMileage,
    odometerAtService: null,
    date: new Date().toISOString(),
    items: [],
    subtotal: 0,
    // No discount/tax entry at creation — simpler than deciding per-order up
    // front. Discount stays adjustable once the order is open; tax defaults
    // to the shop's own configured rate instead of a hardcoded value, so
    // it's never disconnected from Settings.
    discountAmount: 0,
    taxPercent: taxRate,
    taxAmount: 0,
    total: 0,
    paymentMethod: 'pending',
    status: 'open',
    notes: draft.notes,
  }
}
