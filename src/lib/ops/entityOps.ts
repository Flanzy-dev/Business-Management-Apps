// Entity lifecycle entry points. Mostly deletions, which enforce
// src/lib/deletionPolicy.ts against live store data: pages call these instead
// of raw store deletes, and each returns either a blocker message ("why not")
// or performs the delete.
//
// Creating a customer or a vehicle is here for the mirror-image reason. A new
// vehicle is never just a row — it also writes the activity log, may claim its
// owner's default slot, and seeds a whole set of schedule rules. Two screens now
// create vehicles (the Vehicles page and the New Order dialog's inline step),
// and a create path that forgets one of those steps produces a vehicle the
// reminder engine silently ignores.
//
// Stores arrive through `deps` (src/lib/ops/deps.ts) so the guard and the
// delete can be exercised together in a test — deletionPolicy.ts's own tests
// cover the "why not" decision, but not that the delete is actually skipped.
// See src/lib/__tests__/entityOps.test.ts for that half.
//
// The three entity types the accountability log covers (customer, company,
// vehicle) get their log entry written here rather than by the calling page:
// the label has to be read while the row still exists, which is a step earlier
// than the page can see, and a delete path that forgets to log is a silent gap
// no test could catch. See src/lib/ops/activityOps.ts.
// Named exports at the bottom keep every call site unchanged.
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
import { createActivityOps } from './activityOps'
import { createScheduleOps, type ScheduleOpsDeps } from './scheduleOps'
import { findEngineOilItemType, vehicleLabelWithPlate } from '../entities'
import type { Customer } from '../../store/customerStore'
import type { Vehicle } from '../../store/vehicleStore'
import type { ScheduleRule } from '../../store/scheduleRuleStore'
import type { ScheduleChoice } from '../vehicleForm'
import { realOpsDeps, type OpsDeps } from './deps'

export type DeleteResult = { ok: true } | { ok: false; reason: string }

export type EntityOpsDeps = Pick<
  OpsDeps,
  | 'activityLog'
  | 'mode'
  | 'customers'
  | 'companies'
  | 'vehicles'
  | 'workers'
  | 'inventory'
  | 'suppliers'
  | 'workOrders'
  | 'scheduleRules'
  | 'serviceItemTypes'
  | 'productCategories'
  | 'expenses'
> &
  ScheduleOpsDeps

function guarded(blocker: DeletionBlocker, doDelete: () => void): DeleteResult {
  if (blocker) return { ok: false, reason: blocker }
  doDelete()
  return { ok: true }
}

export function createEntityOps(deps: EntityOpsDeps) {
  // Built from the same deps rather than importing the bound singleton, so a
  // test driving createEntityOps sees its own log — same reason orderOps.ts
  // builds its own createScheduleOps instance.
  const { recordEntityChange } = createActivityOps(deps)
  // Same reasoning as the activity ops above, and as orderOps.ts — built from
  // these deps so a test driving a create sees its own schedule rules.
  const { setScheduleRule, seedDefaultScheduleRules, seedScheduleRulesFromServices } = createScheduleOps(deps)

  function createCustomer(data: Omit<Customer, 'id' | 'createdAt'>): Customer {
    const customer = deps.customers.getState().addCustomer(data)
    recordEntityChange('create', 'customer', customer.id, data.name)
    return customer
  }

  /**
   * The customer_interval tail of createVehicleWithSchedule: supersede the
   * seeded engine-oil rule with the km interval the customer asked for at
   * intake, keeping whichever date axis the catalog seeded it with — the
   * customer named a distance, not a deadline. Returns false, applying
   * nothing, when this shop has renamed the engine-oil item type away and
   * there's nothing to apply it to.
   */
  function applyCustomerOilInterval(vehicle: Vehicle, seededRules: ScheduleRule[], oilIntervalKm: number): boolean {
    const oilType = findEngineOilItemType(deps.serviceItemTypes.getState().serviceItemTypes)
    if (!oilType) return false

    // Supersede rather than edit — the seeded rule keeps whatever time-based
    // axis the catalog gave it, because the customer named a distance, not a
    // deadline.
    const seededOil = seededRules.find((r) => r.itemTypeId === oilType.id)
    setScheduleRule(vehicle.id, oilType.id, {
      intervalKm: oilIntervalKm,
      baseOdometer: vehicle.currentMileage ?? 0,
      intervalMonths: seededOil?.intervalMonths ?? null,
      baseDate: seededOil?.baseDate ?? null,
      source: 'customer_request',
    })
    return true
  }

  /**
   * Create a vehicle and everything that has to happen with it: the activity
   * log entry, the owner's default-vehicle slot, and its service schedule.
   *
   * The schedule follows the radio the Add Vehicle form's `schedule.mode` says:
   * - `workshop_default` — seed a rule for exactly `schedule.serviceIds` (the
   *   checklist's ticked catalog services). Empty means seed nothing (every
   *   row unticked).
   * - `customer_interval` — seed every item type the catalog can unambiguously
   *   resolve, then replace the engine-oil rule with `schedule.oilIntervalKm`,
   *   the interval the customer asked for. Only engine oil: "ganti tiap 3.000
   *   km" is about their oil, never their gardan. If this shop has renamed
   *   the engine-oil item type away, the defaults stand and
   *   `oilIntervalApplied` comes back false so the caller can say so rather
   *   than pretending the request was recorded.
   * - `custom` — seed nothing; the shop sets the schedule up later.
   */
  function createVehicleWithSchedule(
    data: Omit<Vehicle, 'id' | 'createdAt'>,
    schedule: ScheduleChoice
  ): { vehicle: Vehicle; seededRules: ScheduleRule[]; oilIntervalApplied: boolean } {
    const vehicleStore = deps.vehicles.getState()
    const vehicle = vehicleStore.addVehicle(data)
    recordEntityChange('create', 'vehicle', vehicle.id, vehicleLabelWithPlate(data))
    // addVehicle alone can't clear a sibling vehicle's default flag —
    // setDefaultVehicle does that in one pass.
    if (data.isDefault) vehicleStore.setDefaultVehicle(vehicle.id)

    if (schedule.mode === 'custom') return { vehicle, seededRules: [], oilIntervalApplied: false }

    if (schedule.mode === 'workshop_default') {
      const seededRules = seedScheduleRulesFromServices(vehicle.id, vehicle.currentMileage, schedule.serviceIds)
      return { vehicle, seededRules, oilIntervalApplied: false }
    }

    // customer_interval — still seeds every unambiguously resolvable item type.
    const seededRules = seedDefaultScheduleRules(vehicle.id, vehicle.currentMileage)
    if (schedule.oilIntervalKm == null) {
      return { vehicle, seededRules, oilIntervalApplied: false }
    }

    const oilIntervalApplied = applyCustomerOilInterval(vehicle, seededRules, schedule.oilIntervalKm)
    return { vehicle, seededRules, oilIntervalApplied }
  }

  function deleteCustomerChecked(id: string): DeleteResult {
    const customers = deps.customers.getState()
    const { vehicles } = deps.vehicles.getState()
    // Read the label while the row still exists — after the delete there is
    // nothing left to name it by, and a bare id means nothing to an admin
    // reading the log later.
    const label = customers.customers.find((c) => c.id === id)?.name ?? id
    return guarded(customerDeletionBlocker(id, vehicles), () => {
      customers.deleteCustomer(id)
      recordEntityChange('delete', 'customer', id, label)
    })
  }

  function deleteCompanyChecked(id: string): DeleteResult {
    const companies = deps.companies.getState()
    const { vehicles } = deps.vehicles.getState()
    const label = companies.companies.find((c) => c.id === id)?.companyName ?? id
    return guarded(companyDeletionBlocker(id, vehicles), () => {
      companies.deleteCompany(id)
      recordEntityChange('delete', 'company', id, label)
    })
  }

  function deleteVehicleChecked(id: string): DeleteResult {
    const vehicleStore = deps.vehicles.getState()
    const { workOrders } = deps.workOrders.getState()
    const { scheduleRules } = deps.scheduleRules.getState()
    const label = vehicleLabelWithPlate(vehicleStore.vehicles.find((v) => v.id === id))
    return guarded(vehicleDeletionBlocker(id, workOrders, scheduleRules), () => {
      vehicleStore.deleteVehicle(id)
      recordEntityChange('delete', 'vehicle', id, label)
    })
  }

  function deleteServiceItemTypeChecked(id: string): DeleteResult {
    const { scheduleRules } = deps.scheduleRules.getState()
    const { workOrders } = deps.workOrders.getState()
    return guarded(serviceItemTypeDeletionBlocker(id, scheduleRules, workOrders), () =>
      deps.serviceItemTypes.getState().deleteServiceItemType(id)
    )
  }

  function deleteProductChecked(id: string): DeleteResult {
    const { workOrders } = deps.workOrders.getState()
    const { expenses } = deps.expenses.getState()
    return guarded(productDeletionBlocker(id, workOrders, expenses), () =>
      deps.inventory.getState().deleteProduct(id)
    )
  }

  function deleteProductCategoryChecked(id: string): DeleteResult {
    const categoryStore = deps.productCategories.getState()
    const category = categoryStore.getProductCategory(id)
    const { products } = deps.inventory.getState()
    return guarded(
      category ? productCategoryDeletionBlocker(category.name, products) : null,
      () => categoryStore.deleteProductCategory(id)
    )
  }

  function deleteWorkerChecked(id: string): DeleteResult {
    const { workOrders } = deps.workOrders.getState()
    return guarded(workerDeletionBlocker(id, workOrders), () =>
      deps.workers.getState().deleteWorker(id)
    )
  }

  /**
   * Suppliers always delete; their products are detached (supplierId → null)
   * rather than orphaned. Returns how many were detached for the toast.
   */
  function deleteSupplierDetaching(id: string): { detachedProducts: number } {
    const inventory = deps.inventory.getState()
    const detached = productsToDetachFromSupplier(id, inventory.products)
    for (const p of detached) inventory.updateProduct(p.id, { supplierId: null })
    deps.suppliers.getState().deleteSupplier(id)
    return { detachedProducts: detached.length }
  }

  return {
    createCustomer,
    createVehicleWithSchedule,
    deleteCustomerChecked,
    deleteCompanyChecked,
    deleteVehicleChecked,
    deleteServiceItemTypeChecked,
    deleteProductChecked,
    deleteProductCategoryChecked,
    deleteWorkerChecked,
    deleteSupplierDetaching,
  }
}

// The one real instance the running app uses.
const defaultOps = createEntityOps(realOpsDeps)

export const createCustomer = defaultOps.createCustomer
export const createVehicleWithSchedule = defaultOps.createVehicleWithSchedule
export const deleteCustomerChecked = defaultOps.deleteCustomerChecked
export const deleteCompanyChecked = defaultOps.deleteCompanyChecked
export const deleteVehicleChecked = defaultOps.deleteVehicleChecked
export const deleteServiceItemTypeChecked = defaultOps.deleteServiceItemTypeChecked
export const deleteProductChecked = defaultOps.deleteProductChecked
export const deleteProductCategoryChecked = defaultOps.deleteProductCategoryChecked
export const deleteWorkerChecked = defaultOps.deleteWorkerChecked
export const deleteSupplierDetaching = defaultOps.deleteSupplierDetaching
