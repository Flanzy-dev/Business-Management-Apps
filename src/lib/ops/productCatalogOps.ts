// Applying a planned price-list import to the product catalog.
//
// Deliberately NOT part of inventoryOps.ts. That module exists to keep a stock
// change and the cash it represents from ever drifting apart; this one opens no
// lots, records no movements and creates no expense — it's catalog CRUD plus
// category creation, and filing it under an invariant it doesn't participate in
// only made both harder to read.
import type { ImportPlan } from '../productImport'
import { realOpsDeps, type OpsDeps } from './deps'

interface ImportOutcome {
  created: number
  pricesUpdated: number
  categoriesCreated: number
}

export type ProductCatalogOpsDeps = Pick<OpsDeps, 'inventory' | 'productCategories'>

/**
 * Apply a price-list import (planned by src/lib/productImport.ts).
 *
 * Deliberately opens no lots and records no movements: every imported product
 * lands at zero stock, exactly like one added through the form with Qty On
 * Hand left at 0. Stock — and the cost that goes with it — arrives later
 * through restockProduct, so a catalog load can never invent inventory the
 * shop doesn't have or put a made-up cost into the FIFO chain.
 *
 * Price updates are opt-in (`updatePrices`) because refreshing what the shop
 * charges is a pricing decision, not a consequence of loading a supplier's
 * sheet. Categories the file names but the shop doesn't have yet are created
 * first, so the new products aren't filed under a category that isn't in the
 * Settings list.
 */
export function createProductCatalogOps(deps: ProductCatalogOpsDeps) {
  function applyProductImport(
    plan: ImportPlan,
    options: { updatePrices: boolean }
  ): ImportOutcome {
    const categoryStore = deps.productCategories.getState()
    for (const name of plan.newCategories) {
      categoryStore.addProductCategory({ name })
    }

    const created = deps.inventory.getState().addProducts(
      plan.create.map((row) => ({
        name: row.name,
        sku: row.sku,
        // Already in stored form (uppercased) by parseProductCsv. Not unique —
        // these are "modal" codes encoding cost, so products bought at the same
        // price share one; see normalizeSupplierCode.
        supplierCode: row.supplierCode,
        category: row.category,
        unit: row.unit,
        costPrice: row.costPrice,
        sellPrice: row.sellPrice,
        reorderPoint: row.reorderPoint,
        // Resolved from the file's supplier *name* while planning — see
        // planProductImport. null when the file named none, or named one this
        // shop doesn't have.
        supplierId: row.supplierId,
        notes: row.notes,
      }))
    )

    let pricesUpdated = 0
    if (options.updatePrices) {
      const { updateProduct } = deps.inventory.getState()
      for (const { product, to } of plan.updatePrice) {
        updateProduct(product.id, { sellPrice: to })
        pricesUpdated++
      }
    }

    return { created: created.length, pricesUpdated, categoriesCreated: plan.newCategories.length }
  }

  return { applyProductImport }
}

// The one real instance the running app uses.
const defaultOps = createProductCatalogOps(realOpsDeps)

export const applyProductImport = defaultOps.applyProductImport
