---
tags: [moc, architecture]
---

# _Architecture Overview — Surya Baru Service Console

Auto-generated map of **70 modules** and **202 import edges** across `src/`.
Open this folder as an Obsidian vault and hit the **graph view** (Ctrl/Cmd+G) to explore.

## Layers (top → bottom)

The app is a clean layered dependency flow — the arrow of imports points *downward*:

```
Shell (main → App → Layout)
   │
Pages (routes)
   │        ╲
Widgets    Ops / Domain Logic  (entityOps, orderOps → deletionPolicy, orderLifecycle)
 (dashboard/reports/ui)      │
   │        ╱                 │
Lib / Utilities (currency, dates, entities, finance, units…)
   │
Stores (Zustand)  ← the data foundation; entityHelpers is the shared base
```

### Shell  (5)
- [[App|App]] — in 1 / out 17
- [[components__GlobalSearch|components/GlobalSearch]] — in 1 / out 5
- [[components__Layout|components/Layout]] — in 1 / out 5
- [[components__Receipt|components/Receipt]] — in 1 / out 7
- [[main|main]] — in 0 / out 1

### Pages  (16)
- [[pages__Appointments|pages/Appointments]] — in 1 / out 6
- [[pages__Bays|pages/Bays]] — in 1 / out 6
- [[pages__Companies|pages/Companies]] — in 1 / out 4
- [[pages__Customers|pages/Customers]] — in 1 / out 4
- [[pages__Dashboard|pages/Dashboard]] — in 1 / out 20
- [[pages__Expenses|pages/Expenses]] — in 1 / out 3
- [[pages__Inventory|pages/Inventory]] — in 1 / out 6
- [[pages__Messages|pages/Messages]] — in 1 / out 0
- [[pages__Profile|pages/Profile]] — in 1 / out 3
- [[pages__Reports|pages/Reports]] — in 1 / out 10
- [[pages__ServiceHistory|pages/ServiceHistory]] — in 1 / out 9
- [[pages__Settings|pages/Settings]] — in 1 / out 3
- [[pages__Suppliers|pages/Suppliers]] — in 1 / out 4
- [[pages__Technicians|pages/Technicians]] — in 1 / out 4
- [[pages__Vehicles|pages/Vehicles]] — in 1 / out 11
- [[pages__WorkOrders|pages/WorkOrders]] — in 1 / out 17

### Dashboard Widgets  (9)
- [[components__dashboard__StatCard|components/dashboard/StatCard]] — in 2 / out 1
- [[components__dashboard__AppointmentTrendChart|components/dashboard/AppointmentTrendChart]] — in 1 / out 1
- [[components__dashboard__BayCapacityGauge|components/dashboard/BayCapacityGauge]] — in 1 / out 1
- [[components__dashboard__BayStatusBoard|components/dashboard/BayStatusBoard]] — in 1 / out 0
- [[components__dashboard__BayThroughputChart|components/dashboard/BayThroughputChart]] — in 1 / out 1
- [[components__dashboard__LowStockRail|components/dashboard/LowStockRail]] — in 1 / out 0
- [[components__dashboard__RepeatCustomerChart|components/dashboard/RepeatCustomerChart]] — in 1 / out 1
- [[components__dashboard__ServiceMixTable|components/dashboard/ServiceMixTable]] — in 1 / out 0
- [[components__dashboard__TechnicianQueue|components/dashboard/TechnicianQueue]] — in 1 / out 0

### Report Widgets  (4)
- [[components__reports__ExpenseCategoryBar|components/reports/ExpenseCategoryBar]] — in 1 / out 3
- [[components__reports__PaymentMethodBreakdown|components/reports/PaymentMethodBreakdown]] — in 1 / out 3
- [[components__reports__PnlReport|components/reports/PnlReport]] — in 1 / out 11
- [[components__reports__RevenueExpenseTrendChart|components/reports/RevenueExpenseTrendChart]] — in 1 / out 3

### UI Primitives  (10)
- [[components__ui__DropdownMenu|components/ui/DropdownMenu]] — in 8 / out 0  🔴 god node
- [[components__ui__Badge|components/ui/Badge]] — in 4 / out 0
- [[components__ui__Card|components/ui/Card]] — in 4 / out 0
- [[components__ui__Button|components/ui/Button]] — in 3 / out 0
- [[components__ui__Dialog|components/ui/Dialog]] — in 2 / out 1
- [[components__ui__IconButton|components/ui/IconButton]] — in 2 / out 0
- [[components__ui__Input|components/ui/Input]] — in 1 / out 0
- [[components__ui__SunkenTile|components/ui/SunkenTile]] — in 1 / out 0
- [[components__ui__Tabs|components/ui/Tabs]] — in 1 / out 0
- [[components__ui__Toast|components/ui/Toast]] — in 1 / out 1

### Hooks  (1)
- [[hooks__useKeyboardShortcuts|hooks/useKeyboardShortcuts]] — in 1 / out 0

### Ops / Domain Logic  (4)
- [[lib__ops__entityOps|lib/ops/entityOps]] — in 6 / out 8
- [[lib__deletionPolicy|lib/deletionPolicy]] — in 1 / out 3
- [[lib__ops__orderOps|lib/ops/orderOps]] — in 1 / out 3
- [[lib__orderLifecycle|lib/orderLifecycle]] — in 1 / out 1

### Lib / Utilities  (8)
- [[lib__currency|lib/currency]] — in 11 / out 0  🔴 god node
- [[lib__chartTheme|lib/chartTheme]] — in 7 / out 0
- [[lib__dates|lib/dates]] — in 6 / out 0
- [[lib__entities|lib/entities]] — in 6 / out 4
- [[lib__finance|lib/finance]] — in 5 / out 3
- [[lib__units|lib/units]] — in 4 / out 0
- [[lib__persistence|lib/persistence]] — in 1 / out 0
- [[lib__validators|lib/validators]] — in 1 / out 0

### Stores (Zustand)  (13)
- [[store__workOrderStore|store/workOrderStore]] — in 14 / out 1  🔴 god node
- [[store__vehicleStore|store/vehicleStore]] — in 12 / out 1  🔴 god node
- [[store__customerStore|store/customerStore]] — in 11 / out 1  🔴 god node
- [[store__companyStore|store/companyStore]] — in 9 / out 1  🔴 god node
- [[store__workerStore|store/workerStore]] — in 9 / out 1  🔴 god node
- [[store__entityHelpers|store/entityHelpers]] — in 8 / out 0  🔴 god node
- [[store__inventoryStore|store/inventoryStore]] — in 8 / out 1  🔴 god node
- [[store__toastStore|store/toastStore]] — in 8 / out 0  🔴 god node
- [[store__expenseStore|store/expenseStore]] — in 3 / out 1
- [[store__supplierStore|store/supplierStore]] — in 3 / out 1
- [[store__bayStore|store/bayStore]] — in 2 / out 0
- [[store__settingsStore|store/settingsStore]] — in 2 / out 0
- [[store__appointmentStore|store/appointmentStore]] — in 1 / out 0

## God nodes (highest fan-in — the blast radius of a change)

1. [[store__workOrderStore|store/workOrderStore]] — imported by **14** modules
1. [[store__vehicleStore|store/vehicleStore]] — imported by **12** modules
1. [[lib__currency|lib/currency]] — imported by **11** modules
1. [[store__customerStore|store/customerStore]] — imported by **11** modules
1. [[store__companyStore|store/companyStore]] — imported by **9** modules
1. [[store__workerStore|store/workerStore]] — imported by **9** modules
1. [[components__ui__DropdownMenu|components/ui/DropdownMenu]] — imported by **8** modules
1. [[store__entityHelpers|store/entityHelpers]] — imported by **8** modules
1. [[store__inventoryStore|store/inventoryStore]] — imported by **8** modules
1. [[store__toastStore|store/toastStore]] — imported by **8** modules

## Hub modules (highest fan-out — the biggest orchestrators)

1. [[pages__Dashboard|pages/Dashboard]] — imports **20** modules
1. [[App|App]] — imports **17** modules
1. [[pages__WorkOrders|pages/WorkOrders]] — imports **17** modules
1. [[components__reports__PnlReport|components/reports/PnlReport]] — imports **11** modules
1. [[pages__Vehicles|pages/Vehicles]] — imports **11** modules
1. [[pages__Reports|pages/Reports]] — imports **10** modules
1. [[pages__ServiceHistory|pages/ServiceHistory]] — imports **9** modules
1. [[lib__ops__entityOps|lib/ops/entityOps]] — imports **8** modules

## Bridges & notable structure

- **[[lib__entities|lib/entities]]** is the *resolver bridge*: it fans into the four identity stores (customer, company, vehicle, worker) so pages can resolve names without touching every store directly.
- **[[lib__finance|lib/finance]]** bridges the transactional stores (workOrder + expense) and `dates` into the report widgets — the whole P&L rests on it.
- **[[lib__ops__entityOps|lib/ops/entityOps]]** + **[[lib__ops__orderOps|lib/ops/orderOps]]** are the deepened *ops layer*: pages call these instead of mutating stores directly, and they route deletes/lifecycle through **[[lib__deletionPolicy|deletionPolicy]]** and **[[lib__orderLifecycle|orderLifecycle]]**. This is the seam that isolates business rules from UI.
- **[[store__entityHelpers|store/entityHelpers]]** is the shared base every entity store is built on — the single most-reused foundation in the app.

## Suggested questions to explore

- If I change **[[store__workOrderStore|workOrderStore]]**, what breaks? (trace *Imported by*)
- How does a delete flow from a **Page → ops → deletionPolicy → stores**?
- What does the P&L report actually depend on? (walk **[[components__reports__PnlReport|PnlReport]]** down)
- Which pages bypass the ops layer and hit stores directly? (compare Pages' imports)
