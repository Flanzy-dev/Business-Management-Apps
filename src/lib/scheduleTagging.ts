// Resolves which vehicle-schedule item (ServiceItemType) a product changes, so
// selling it automatically tags the work-order line the same way a linked
// catalog service already does (see serviceCatalog.ts's
// resolveDefaultCatalogMatch, the sibling lookup for services). Pure — no
// store access, same pattern as every other lib/ file in this subsystem.
//
// Resolution order: the product's own override, then its category's mapping,
// then a built-in default for a category this app seeded itself, then none.
// An explicit null at any step means "deliberately none" and stops there —
// only an absent (undefined) key falls through to the next step.
import type { Product } from '../store/inventoryStore'
import type { ProductCategory } from '../store/productCategoryStore'
import type { ServiceItemType } from '../store/serviceItemTypeStore'
import { ENGINE_OIL_ITEM_TYPE_NAME } from './entities'

// Built-in category name -> built-in item-type name. Matched by name, same
// reasoning as entities.ts's findEngineOilItemType: ids are generated fresh
// per device on first run, so there's no stable id to hardcode. A shop's own
// category (not in this table) resolves to nothing here — explicit
// per-category or per-product mapping is still available for it.
// 'Oli Transmisi / Gardan' is deliberately absent: it spans two different
// schedule items (Oli Transmisi, Oli Gardan) and guessing between them is
// exactly what resolveDefaultCatalogMatch already refuses to do, for the same
// reason. 'Gemuk' and 'Additive / Pembersih' have no schedule-item counterpart
// at all.
const BUILTIN_CATEGORY_ITEM_TYPE_NAMES: Record<string, string> = {
  'Oli Mesin Diesel': ENGINE_OIL_ITEM_TYPE_NAME,
  'Oli Mesin Bensin': ENGINE_OIL_ITEM_TYPE_NAME,
  'Oli Mesin Motor / Matic': ENGINE_OIL_ITEM_TYPE_NAME,
  'Pendingin & Minyak Rem': 'Minyak Rem',
}

function builtinItemTypeIdForCategory(categoryName: string, itemTypes: ServiceItemType[]): string | null {
  const name = BUILTIN_CATEGORY_ITEM_TYPE_NAMES[categoryName]
  if (!name) return null
  return itemTypes.find((it) => it.name === name)?.id ?? null
}

/**
 * The ServiceItemType a product changes, or null if none applies. Selling
 * this product on a work order (WorkOrderEditor.tsx's handleAddProduct) tags
 * the line with it, the same way picking a linked catalog service already
 * does (serviceCatalog.ts's serviceCatalogLine) — see scheduleOps.ts for what
 * that tag then does to the vehicle's schedule on completion.
 */
export function resolveProductScheduleTag(
  product: Pick<Product, 'category' | 'serviceItemTypeId'>,
  categories: ProductCategory[],
  itemTypes: ServiceItemType[]
): string | null {
  if (product.serviceItemTypeId !== undefined) return product.serviceItemTypeId

  const category = categories.find((c) => c.name === product.category)
  if (category && category.serviceItemTypeId !== undefined) return category.serviceItemTypeId

  return builtinItemTypeIdForCategory(product.category, itemTypes)
}
