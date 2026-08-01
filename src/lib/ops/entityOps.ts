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
import { useScheduleRuleStore } from '../../store/scheduleRuleStore'
import { useServiceItemTypeStore } from '../../store/serviceItemTypeStore'
import { useProductCategoryStore } from '../../store/productCategoryStore'
import { useExpenseStore } from '../../store/expenseStore'
import {
  customerDeletionBlocker,
  companyDeletionBlocker,
  vehicleDeletionBlocker,
  productDeletionBlocker,
  productCategoryDeletionBlocker,
  workerDeletionBlocker,
  serviceItemTypeDeletionBlocker,
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
  const { scheduleRules } = useScheduleRuleStore.getState()
  return guarded(vehicleDeletionBlocker(id, workOrders, scheduleRules), () =>
    useVehicleStore.getState().deleteVehicle(id)
  )
}

export function deleteServiceItemTypeChecked(id: string): DeleteResult {
  const { scheduleRules } = useScheduleRuleStore.getState()
  const { workOrders } = useWorkOrderStore.getState()
  return guarded(serviceItemTypeDeletionBlocker(id, scheduleRules, workOrders), () =>
    useServiceItemTypeStore.getState().deleteServiceItemType(id)
  )
}

export function deleteProductChecked(id: string): DeleteResult {
  const { workOrders } = useWorkOrderStore.getState()
  const { expenses } = useExpenseStore.getState()
  return guarded(productDeletionBlocker(id, workOrders, expenses), () =>
    useInventoryStore.getState().deleteProduct(id)
  )
}

export function deleteProductCategoryChecked(id: string): DeleteResult {
  const categoryStore = useProductCategoryStore.getState()
  const category = categoryStore.getProductCategory(id)
  const { products } = useInventoryStore.getState()
  return guarded(
    category ? productCategoryDeletionBlocker(category.name, products) : null,
    () => categoryStore.deleteProductCategory(id)
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
