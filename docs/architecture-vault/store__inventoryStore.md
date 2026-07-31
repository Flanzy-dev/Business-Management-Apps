---
module: store/inventoryStore
layer: Stores (Zustand)
tags: [store]
fan_in: 8
fan_out: 1
---

# store/inventoryStore

`src/store/inventoryStore.ts` · **layer:** Stores (Zustand) · **imported by 8** · **imports 1**

> [!warning] God node — high fan-in. Changes here ripple widely.

## Imports
- [[store__entityHelpers|store/entityHelpers]]  _( Stores (Zustand) )_

## Imported by
- [[components__reports__PnlReport|components/reports/PnlReport]]  _( Report Widgets )_
- [[lib__deletionPolicy|lib/deletionPolicy]]  _( Ops / Domain Logic )_
- [[lib__ops__entityOps|lib/ops/entityOps]]  _( Ops / Domain Logic )_
- [[lib__ops__orderOps|lib/ops/orderOps]]  _( Ops / Domain Logic )_
- [[pages__Dashboard|pages/Dashboard]]  _( Pages )_
- [[pages__Inventory|pages/Inventory]]  _( Pages )_
- [[pages__Reports|pages/Reports]]  _( Pages )_
- [[pages__WorkOrders|pages/WorkOrders]]  _( Pages )_

---
[[_Architecture Overview]]