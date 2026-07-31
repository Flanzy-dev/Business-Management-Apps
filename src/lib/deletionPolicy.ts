// Referential-integrity rules for entity deletion. Each check answers one
// question: "what, if anything, blocks deleting this entity?" — returning a
// user-facing reason string, or null when the delete may proceed. The store
// deletes themselves stay dumb; pages go through src/lib/ops/entityOps.ts
// which runs these against live store data.
import type { Vehicle } from '../store/vehicleStore'
import type { WorkOrder } from '../store/workOrderStore'
import type { Product } from '../store/inventoryStore'

/** null = deletable; string = user-facing reason the delete is blocked. */
export type DeletionBlocker = string | null

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`

export function customerDeletionBlocker(customerId: string, vehicles: Vehicle[]): DeletionBlocker {
  const owned = vehicles.filter(v => v.customerId === customerId).length
  if (owned === 0) return null
  return `This customer still owns ${plural(owned, 'vehicle')}. Delete or reassign them first.`
}

export function companyDeletionBlocker(companyId: string, vehicles: Vehicle[]): DeletionBlocker {
  const owned = vehicles.filter(v => v.companyId === companyId).length
  if (owned === 0) return null
  return `This company still owns ${plural(owned, 'vehicle')}. Delete or reassign them first.`
}

export function vehicleDeletionBlocker(vehicleId: string, workOrders: WorkOrder[]): DeletionBlocker {
  const orders = workOrders.filter(wo => wo.vehicleId === vehicleId).length
  if (orders === 0) return null
  return `This vehicle has ${plural(orders, 'service order')} on record. Delete those orders first to keep history consistent.`
}

/**
 * Products referenced by order items carry the shop's COGS/service history —
 * deleting them turns that revenue into "unknown product" in reports.
 */
export function productDeletionBlocker(productId: string, workOrders: WorkOrder[]): DeletionBlocker {
  const referenced = workOrders.filter(wo => wo.items.some(item => item.productId === productId)).length
  if (referenced === 0) return null
  return `This product appears on ${plural(referenced, 'service order')}. Deleting it would lose cost history in reports.`
}

export function workerDeletionBlocker(workerId: string, workOrders: WorkOrder[]): DeletionBlocker {
  const assigned = workOrders.filter(wo => wo.workerId === workerId).length
  if (assigned === 0) return null
  return `This technician is assigned to ${plural(assigned, 'service order')}. Mark them inactive instead of deleting.`
}

/**
 * Suppliers are never blocked — deleting one detaches its products
 * (supplierId → null). Returns the products that will be detached so the
 * caller can apply the cleanup and inform the user.
 */
export function productsToDetachFromSupplier(supplierId: string, products: Product[]): Product[] {
  return products.filter(p => p.supplierId === supplierId)
}
