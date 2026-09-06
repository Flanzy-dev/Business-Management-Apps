// Applying a planned services CSV import — the Services counterpart to
// src/lib/ops/productCatalogOps.ts. Deliberately not part of scheduleOps.ts:
// this is catalog CRUD plus item-type creation, and it never touches a
// vehicle's live schedule (that only happens when a service is actually
// sold on a work order, not when it's added to the price list).
import type { ServiceImportPlan } from '../serviceImport'
import { realOpsDeps, type OpsDeps } from './deps'

interface ImportOutcome {
  created: number
  pricesUpdated: number
  itemTypesCreated: number
}

export type ServiceCatalogOpsDeps = Pick<OpsDeps, 'serviceCatalog' | 'serviceItemTypes'>

/**
 * Apply a services CSV import (planned by src/lib/serviceImport.ts).
 *
 * Schedule tags the file names but the shop doesn't have yet are created
 * FIRST, then resolved back to real ids for the services that reference
 * them by name — planServiceImport can't know a new tag's id before it
 * exists, so every create row whose `scheduleTag` named a *new* tag arrives
 * here with `serviceItemTypeId: null` and its typed name still in
 * `scheduleTag`; this re-resolves those specific rows against the
 * just-created tags, by name, and leaves every row that already had a real
 * id (an existing tag, or genuinely no tag) untouched. Same two-phase
 * order as applyProductImport's category creation, for the same reason: a
 * service filed under a tag that isn't in Settings yet would look broken
 * the moment someone opens the Schedule Tag dropdown.
 *
 * Price updates are opt-in (`updatePrices`), same as applyProductImport's:
 * refreshing what the shop charges is a pricing decision, not a consequence
 * of loading a sheet — a service the shop has been charging a real price
 * for could otherwise be silently repriced by a file that happens to name
 * it the same thing.
 */
export function createServiceCatalogOps(deps: ServiceCatalogOpsDeps) {
  function applyServiceImport(plan: ServiceImportPlan, options: { updatePrices: boolean }): ImportOutcome {
    const itemTypeStore = deps.serviceItemTypes.getState()
    const newIdByName = new Map<string, string>()
    for (const name of plan.newItemTypes) {
      const created = itemTypeStore.addServiceItemType({ name })
      newIdByName.set(name.trim().toLowerCase(), created.id)
    }

    const created = deps.serviceCatalog.getState().addServices(
      plan.create.map((row) => ({
        name: row.name,
        price: row.price,
        serviceItemTypeId: row.serviceItemTypeId ?? newIdByName.get(row.scheduleTag.trim().toLowerCase()) ?? null,
        intervalKm: row.intervalKm,
        intervalMonths: row.intervalMonths,
        notes: row.notes,
      }))
    )

    let pricesUpdated = 0
    if (options.updatePrices) {
      const { updateService } = deps.serviceCatalog.getState()
      for (const { service, to } of plan.updatePrice) {
        updateService(service.id, { price: to })
        pricesUpdated++
      }
    }

    return { created: created.length, pricesUpdated, itemTypesCreated: plan.newItemTypes.length }
  }

  return { applyServiceImport }
}

// The one real instance the running app uses.
const defaultOps = createServiceCatalogOps(realOpsDeps)

export const applyServiceImport = defaultOps.applyServiceImport
