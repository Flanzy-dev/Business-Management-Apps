---
module: store/customerStore
layer: Stores (Zustand)
tags: [store]
fan_in: 11
fan_out: 1
---

# store/customerStore

`src/store/customerStore.ts` · **layer:** Stores (Zustand) · **imported by 11** · **imports 1**

> [!warning] God node — high fan-in. Changes here ripple widely.

## Imports
- [[store__entityHelpers|store/entityHelpers]]  _( Stores (Zustand) )_

## Imported by
- [[components__GlobalSearch|components/GlobalSearch]]  _( Shell )_
- [[components__Receipt|components/Receipt]]  _( Shell )_
- [[lib__entities|lib/entities]]  _( Lib / Utilities )_
- [[lib__ops__entityOps|lib/ops/entityOps]]  _( Ops / Domain Logic )_
- [[pages__Appointments|pages/Appointments]]  _( Pages )_
- [[pages__Customers|pages/Customers]]  _( Pages )_
- [[pages__Dashboard|pages/Dashboard]]  _( Pages )_
- [[pages__Reports|pages/Reports]]  _( Pages )_
- [[pages__ServiceHistory|pages/ServiceHistory]]  _( Pages )_
- [[pages__Vehicles|pages/Vehicles]]  _( Pages )_
- [[pages__WorkOrders|pages/WorkOrders]]  _( Pages )_

---
[[_Architecture Overview]]