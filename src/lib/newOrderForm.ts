// The New Work Order dialog's own rules, pulled out of the component that
// renders it (src/components/workOrders/NewWorkOrderDialog.tsx) — same
// "real rules belong in a plain .ts, not a component body" reasoning as
// vehicleForm.ts. This file holds the two largest non-JSX blocks that dialog
// had: the Quick Find search (a single-pass scan across every vehicle,
// matching plate/VIN/owner name at once) and the final draft-to-payload
// mapping for addWorkOrder.
import type { Vehicle } from '../store/vehicleStore'
import type { Customer } from '../store/customerStore'
import type { Company } from '../store/companyStore'
import type { WorkOrder } from '../store/workOrderStore'

export interface QuickFindResult {
  vehicleId: string
  ownerType: 'customer' | 'company'
  ownerId: string
  plate: string
  vehicleLabel: string
  ownerLabel: string
}

/**
 * Vehicles (with their resolved owner) matching `query` against plate, VIN,
 * or owner name — whichever a returning customer is more likely to recall
 * than which owner record their car is filed under. Capped at `limit`: this
 * feeds a dropdown, not a full results page. An owner-less vehicle, or one
 * whose owner record has since been deleted, is silently excluded — Quick
 * Find can't hand off to a picker that has nothing to pick.
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

  const results: QuickFindResult[] = []
  for (const v of vehicles) {
    let ownerLabel: string | undefined
    let owner: Pick<QuickFindResult, 'ownerType' | 'ownerId'> | undefined
    if (v.customerId) {
      const c = customers.find((c) => c.id === v.customerId)
      if (c) {
        ownerLabel = c.name
        owner = { ownerType: 'customer', ownerId: c.id }
      }
    } else if (v.companyId) {
      const c = companies.find((c) => c.id === v.companyId)
      if (c) {
        ownerLabel = c.companyName
        owner = { ownerType: 'company', ownerId: c.id }
      }
    }
    if (!owner || !ownerLabel) continue

    const matches =
      v.licensePlate?.toLowerCase().includes(q) || v.vin?.toLowerCase().includes(q) || ownerLabel.toLowerCase().includes(q)
    if (!matches) continue

    results.push({
      ...owner,
      vehicleId: v.id,
      plate: v.licensePlate || noPlateLabel,
      vehicleLabel: `${v.year ?? ''} ${v.make} ${v.model}`.trim(),
      ownerLabel,
    })
    if (results.length >= limit) break
  }
  return results
}

export interface NewOrderDraft {
  vehicleId: string
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
  tc: (key: string, count: number, vars?: Record<string, string | number>) => string
): { tone: 'success'; title: string; description: string } {
  const order = `SB-${orderNumber}`
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
  return {
    vehicleId: draft.vehicleId,
    workerId: draft.workerId || null,
    driverId: draft.driverId || null,
    // The reading staff typed at the gate — falling back to today's silent
    // snapshot only when the field was left blank. It only moves again once
    // the tech records Odometer at Service (see the editor view).
    odometerAtArrival: draft.odometer.trim() ? parseInt(draft.odometer, 10) : currentMileage,
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
