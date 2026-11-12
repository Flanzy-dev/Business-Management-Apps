// Small related modules kept in one file, one section each with its original notes: deletionPolicy,
// deleteOutcome.
import type { Vehicle } from '../../store/vehicleStore'
import type { WorkOrder } from '../../store/workOrderStore'
import type { Product } from '../../store/inventoryStore'
import type { ScheduleRule } from '../../store/scheduleRuleStore'
import type { Expense } from '../../store/expenseStore'
import type { Appointment } from '../../store/appointmentStore'
import { vehicleReferenceCounts } from '../vehicles/vehicleReferences'
import { translate } from '../i18n'
import type { DeleteResult } from './entityOps'

// ---- deletionPolicy ----

// Referential-integrity rules for entity deletion. Each check answers one
// question: "what, if anything, blocks deleting this entity?" — returning a
// user-facing reason string, or null when the delete may proceed. The store
// deletes themselves stay dumb; pages go through src/lib/ops/entityOps.ts
// which runs these against live store data.

/** null = deletable; string = user-facing reason the delete is blocked. */
export type DeletionBlocker = string | null

/** The translated singular/plural unit word alone, for templates that already interpolate {{count}} separately. */
function pluralWord(n: number, singularKey: string, pluralKey: string): string {
  return translate(n === 1 ? singularKey : pluralKey)
}

/** "{{count}} {{word}}" as one standalone phrase, for joining into a list (no surrounding sentence template). */
function countPhrase(n: number, singularKey: string, pluralKey: string): string {
  return `${n} ${pluralWord(n, singularKey, pluralKey)}`
}

export function customerDeletionBlocker(customerId: string, vehicles: Vehicle[]): DeletionBlocker {
  const owned = vehicles.filter(v => v.customerId === customerId).length
  if (owned === 0) return null
  return translate('deletionPolicy.customerHasVehicles', {
    count: owned,
    vehicleWord: pluralWord(owned, 'deletionPolicy.unitVehicle', 'deletionPolicy.unitVehiclePlural'),
  })
}

export function companyDeletionBlocker(companyId: string, vehicles: Vehicle[]): DeletionBlocker {
  const owned = vehicles.filter(v => v.companyId === companyId).length
  if (owned === 0) return null
  return translate('deletionPolicy.companyHasVehicles', {
    count: owned,
    vehicleWord: pluralWord(owned, 'deletionPolicy.unitVehicle', 'deletionPolicy.unitVehiclePlural'),
  })
}

/**
 * A driver is the one referenced entity that had no rule: `WorkOrder.driverId`
 * points at one (see workOrderStore.ts) and orders are created carrying it,
 * but Companies.tsx deleted drivers behind nothing but a confirm — leaving
 * those orders pointing at a driver that no longer exists. Same shape as every
 * other blocker here so it reads the same at the call site.
 */
export function driverDeletionBlocker(driverId: string, workOrders: WorkOrder[]): DeletionBlocker {
  const orders = workOrders.filter(wo => wo.driverId === driverId).length
  if (orders === 0) return null
  return translate('deletionPolicy.driverHasOrders', {
    count: orders,
    orderWord: pluralWord(orders, 'deletionPolicy.unitServiceOrder', 'deletionPolicy.unitServiceOrderPlural'),
  })
}

/**
 * What blocks deleting a vehicle, from src/lib/vehicles/vehicleReferences.ts's counts
 * — the one module that knows every store pointing at a vehicle. Orders,
 * live schedule rules and appointments block. A reminder follow-up doesn't:
 * it's live "I called them" state, not history, so entityOps clears it along
 * with the vehicle. Service events need no check of their own — each comes
 * from a completed order, which already blocks.
 */
export function vehicleDeletionBlocker(
  vehicleId: string,
  workOrders: WorkOrder[],
  scheduleRules: ScheduleRule[] = [],
  appointments: Appointment[] = []
): DeletionBlocker {
  const refs = vehicleReferenceCounts(vehicleId, { workOrders, scheduleRules, appointments })
  if (refs.orders > 0) {
    return translate('deletionPolicy.vehicleHasOrders', {
      count: refs.orders,
      orderWord: pluralWord(refs.orders, 'deletionPolicy.unitServiceOrder', 'deletionPolicy.unitServiceOrderPlural'),
    })
  }
  // Counted one per item type, so this matches what the user can actually
  // see and delete from ScheduleRulesEditor, not a raw row count sync
  // duplication could have inflated.
  if (refs.activeRules > 0) {
    return translate('deletionPolicy.vehicleHasScheduleRules', {
      count: refs.activeRules,
      ruleWord: pluralWord(refs.activeRules, 'deletionPolicy.unitServiceScheduleRule', 'deletionPolicy.unitServiceScheduleRulePlural'),
    })
  }
  if (refs.appointments > 0) {
    return translate('deletionPolicy.vehicleHasAppointments', { count: refs.appointments })
  }
  return null
}

/**
 * A service item type referenced by any schedule rule (live or superseded,
 * for audit safety) or any tagged work-order line can't be deleted — it would
 * orphan schedule history and past tags.
 */
export function serviceItemTypeDeletionBlocker(
  itemTypeId: string,
  scheduleRules: ScheduleRule[],
  workOrders: WorkOrder[]
): DeletionBlocker {
  const ruleCount = scheduleRules.filter(r => r.itemTypeId === itemTypeId).length
  const taggedLineCount = workOrders.reduce(
    (sum, wo) => sum + wo.items.filter(i => i.serviceItemTypeId === itemTypeId).length,
    0
  )
  if (ruleCount === 0 && taggedLineCount === 0) return null
  const parts: string[] = []
  if (ruleCount > 0) parts.push(countPhrase(ruleCount, 'deletionPolicy.unitScheduleRule', 'deletionPolicy.unitScheduleRulePlural'))
  if (taggedLineCount > 0) parts.push(countPhrase(taggedLineCount, 'deletionPolicy.unitServiceOrderLine', 'deletionPolicy.unitServiceOrderLinePlural'))
  return translate('deletionPolicy.serviceItemTypeReferenced', { parts: parts.join(' and ') })
}

/**
 * Products referenced by order items carry the shop's COGS/service history,
 * and products linked from an Inventory Purchase expense carry a reversible
 * stock link (see recordExpense/deleteExpenseWithStockReversal in
 * src/lib/ops/inventoryOps.ts) — deleting either would turn that history into
 * "unknown product" in reports, or orphan an expense's stock reversal.
 */
export function productDeletionBlocker(
  productId: string,
  workOrders: WorkOrder[],
  expenses: Expense[] = []
): DeletionBlocker {
  const orderCount = workOrders.filter(wo => wo.items.some(item => item.productId === productId)).length
  const expenseCount = expenses.filter(e => e.productId === productId).length
  if (orderCount === 0 && expenseCount === 0) return null
  const parts: string[] = []
  if (orderCount > 0) parts.push(countPhrase(orderCount, 'deletionPolicy.unitServiceOrder', 'deletionPolicy.unitServiceOrderPlural'))
  if (expenseCount > 0) parts.push(countPhrase(expenseCount, 'deletionPolicy.unitExpense', 'deletionPolicy.unitExpensePlural'))
  return translate('deletionPolicy.productReferenced', { parts: parts.join(' and ') })
}

/**
 * A category still assigned to any product can't be deleted — it would leave
 * that product's category as an orphaned string with no entry in the
 * manageable list (and no way to re-select it from the dropdown).
 */
export function productCategoryDeletionBlocker(categoryName: string, products: Product[]): DeletionBlocker {
  const using = products.filter(p => p.category === categoryName).length
  if (using === 0) return null
  return translate('deletionPolicy.categoryUsedByProducts', {
    count: using,
    productWord: pluralWord(using, 'deletionPolicy.unitProduct', 'deletionPolicy.unitProductPlural'),
  })
}

export function workerDeletionBlocker(workerId: string, workOrders: WorkOrder[]): DeletionBlocker {
  const assigned = workOrders.filter(wo => wo.workerId === workerId).length
  if (assigned === 0) return null
  return translate('deletionPolicy.workerAssignedToOrders', {
    count: assigned,
    orderWord: pluralWord(assigned, 'deletionPolicy.unitServiceOrder', 'deletionPolicy.unitServiceOrderPlural'),
  })
}

/**
 * Suppliers are never blocked — deleting one detaches its products
 * (supplierId → null). Returns the products that will be detached so the
 * caller can apply the cleanup and inform the user.
 */
export function productsToDetachFromSupplier(supplierId: string, products: Product[]): Product[] {
  return products.filter(p => p.supplierId === supplierId)
}

// ---- deleteOutcome ----

// The confirm -> checked-delete -> toast shape repeated at 8 call sites
// (Customers, Companies, Vehicles, Technicians, Suppliers, Inventory,
// Settings x2), inconsistently: Customers/Companies/Vehicles fire a success
// toast on top of the blocked-delete warning, Technicians/Inventory/Settings
// don't. This doesn't force one behavior — a page still decides whether it
// wants a success toast by passing `deletedTitle` or leaving it out — it just
// gives the decision one shape instead of eight hand-written if/else blocks.

export interface DeleteOutcomeLabels {
  /** Shown as a warning toast when the delete was blocked; `result.reason`
   *  (already a translated, specific reason from deletion.ts) becomes
   *  the toast's description. */
  cannotDeleteTitle: string
  /** Shown as a success toast on an actual delete. Every page passes one now,
   *  so a delete never ends in silence. */
  deletedTitle?: string
}

export interface ToastSpec {
  tone: 'success' | 'warning'
  title: string
  description?: string
}

/** null means "show nothing" — a successful delete at a page that has no
 *  `deletedTitle` configured. */
export function deleteOutcomeToast(result: DeleteResult, labels: DeleteOutcomeLabels): ToastSpec | null {
  if (!result.ok) return { tone: 'warning', title: labels.cannotDeleteTitle, description: result.reason }
  return labels.deletedTitle ? { tone: 'success', title: labels.deletedTitle } : null
}
