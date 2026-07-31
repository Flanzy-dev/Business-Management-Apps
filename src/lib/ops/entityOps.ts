// Deletion entry points that enforce src/lib/deletionPolicy.ts against live
// store data. Pages call these instead of raw store deletes; each returns
// either a blocker message ("why not") or performs the delete.
import { useCustomerStore } from '../../store/customerStore'
import { useCompanyStore } from '../../store/companyStore'
import { useVehicleStore } from '../../store/vehicleStore'
import { useWorkerStore } from '../../store/workerStore'
import { useInventoryStore } from '../../store/inventoryStore'
import { useSupplierStore } from '../../store/supplierStore'
import { useWorkOrderStore } from '../../store/workOrderStore'
import {
  customerDeletionBlocker,
  companyDeletionBlocker,
  vehicleDeletionBlocker,
  productDeletionBlocker,
  workerDeletionBlocker,
  productsToDetachFromSupplier,
  DeletionBlocker,
} from '../deletionPolicy'

export type DeleteResult = { ok: true } | { ok: false; reason: string }

function guarded(blocker: DeletionBlocker, doDelete: () => void): DeleteResult {
  if (blocker) return { ok: false, reason: blocker }
  doDelete()
  return { ok: true }
}

export function deleteCustomerChecked(id: string): DeleteResult {
  const { vehicles } = useVehicleStore.getState()
  return guarded(customerDeletionBlocker(id, vehicles), () =>
    useCustomerStore.getState().deleteCustomer(id)
  )
}

export function deleteCompanyChecked(id: string): DeleteResult {
  const { vehicles } = useVehicleStore.getState()
  return guarded(companyDeletionBlocker(id, vehicles), () =>
    useCompanyStore.getState().deleteCompany(id)
  )
}

export function deleteVehicleChecked(id: string): DeleteResult {
  const { workOrders } = useWorkOrderStore.getState()
  return guarded(vehicleDeletionBlocker(id, workOrders), () =>
    useVehicleStore.getState().deleteVehicle(id)
  )
}

export function deleteProductChecked(id: string): DeleteResult {
  const { workOrders } = useWorkOrderStore.getState()
  return guarded(productDeletionBlocker(id, workOrders), () =>
    useInventoryStore.getState().deleteProduct(id)
  )
}

export function deleteWorkerChecked(id: string): DeleteResult {
  const { workOrders } = useWorkOrderStore.getState()
  return guarded(workerDeletionBlocker(id, workOrders), () =>
    useWorkerStore.getState().deleteWorker(id)
  )
}

/**
 * Suppliers always delete; their products are detached (supplierId → null)
 * rather than orphaned. Returns how many were detached for the toast.
 */
export function deleteSupplierDetaching(id: string): { detachedProducts: number } {
  const inventory = useInventoryStore.getState()
  const detached = productsToDetachFromSupplier(id, inventory.products)
  for (const p of detached) inventory.updateProduct(p.id, { supplierId: null })
  useSupplierStore.getState().deleteSupplier(id)
  return { detachedProducts: detached.length }
}
