// The one expense category the app treats specially: an expense in it records a
// stock purchase, and is linked to the product and quantity it brought in so
// deleting either reverses the other (src/lib/ops/inventoryOps.ts). It is also
// the stored value, so renaming it would orphan every existing purchase — it is
// a key, not a label (the label is the `categoryInventoryPurchase` i18n string).
//
// Its own tiny module so the store, the pure formatters and the ops can all
// name it without importing one another.
export const INVENTORY_PURCHASE_CATEGORY = 'Inventory Purchase'
