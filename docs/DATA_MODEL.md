# Data model

The data model as it actually runs today: 23 Zustand stores under `src/store/*.ts`, each backed by
one JSON blob in a single generic `key_value_store` table (see
[docs/ARCHITECTURE.md](ARCHITECTURE.md)'s "storage seam" section). This is deliberately **not**
`prisma/schema.prisma` — that file documents a *possible future* relational shape and isn't wired
to the running app (see [CLAUDE.md](../CLAUDE.md)). If the two ever disagree, this document and the
store files themselves are correct.

19 of the 23 stores are persisted and registered in
[src/lib/persistence.ts](../src/lib/persistence.ts)'s `PERSISTED_STORES` — that registry is the
authoritative list; a store missing from it would be invisible to backups and to sync. The
remaining 4 are covered in their own sections below.

All money fields are whole-Rupiah integers (no minor unit). All date/timestamp fields are ISO
strings.

## Customers, companies, vehicles, workers

| Store | Storage key | Backup field | Shape |
|---|---|---|---|
| `customerStore.ts` | `customer-store` | `customers` | `Customer` — name, phone, email, address, notes |
| `companyStore.ts` | `company-store` | `companies` | `Company` — billing/contact info, embeds a `drivers: Driver[]` list (fleet drivers live inside their company, not a separate store) |
| `vehicleStore.ts` | `vehicle-store` | `vehicles` | `Vehicle` — owned by exactly one of `customerId`/`companyId`; make/model/year/VIN/plate; engine, transmission, and gardan/differential specs; `isDefault` marks the owner's primary vehicle |
| `workerStore.ts` | `worker-store` | `workers` | `Worker` — shop technicians; `isActive` rather than deletion, since past work orders reference a worker permanently |

## Work orders

| Store | Storage key | Backup field | Shape |
|---|---|---|---|
| `workOrderStore.ts` | `work-order-store` | `workOrders` | `WorkOrder` — the main transaction record: `vehicleId`/`workerId`/`driverId`, an `items: WorkOrderItem[]` line-item list, totals, `paymentMethod`, `status` (`open`/`completed`/`cancelled`) |

A `WorkOrderItem` line optionally carries `productId` (drives stock auto-deduct on completion),
`costOfGoods` (frozen at completion — see [ARCHITECTURE.md](ARCHITECTURE.md)'s FIFO section), and
optional service-schedule tagging (`serviceItemTypeId`, `quantityLiters`, `serviceAction`,
`containerType`) that feeds the vehicle's due-service schedule. **Never write to this store
directly for completion or deletion** — [src/lib/ops/orderOps.ts](../src/lib/ops/orderOps.ts) owns
the inventory/costing/ledger side effects those transitions carry.

## Inventory (FIFO-costed)

| Store | Storage key | Backup field | Shape |
|---|---|---|---|
| `inventoryStore.ts` | `inventory-store` | `inventory` | `Product` — name/SKU/`supplierCode`/category/unit, `costPrice`/`sellPrice`, `reorderPoint`. `sku` is the shop's own code (unique when set); `supplierCode` is the supplier price list's code — here the "modal" code, which encodes cost, so it's uppercase but **not** unique. **No quantity field** — see below. |
| `stockLotStore.ts` | `stock-lot-store` | `stockLots` | `StockLot` — one row per stock arrival: `productId`, `unitCost` (what that batch actually cost), `qtyReceived`, `receivedAt`, optional linked `expenseId` |
| `stockMovementStore.ts` | `stock-movement-store` | `stockMovements` | `StockMovement` — one row per quantity change, signed `delta`, append-only; `mode` + `deviceId` attribute who recorded it, same stand-in-for-a-per-user-identity convention as `activityLogStore` |

`Product.qtyOnHand` does not exist as a stored field. Current stock is always `Σ delta` over that
product's `StockMovement` rows — see [src/lib/stockLedger.ts](../src/lib/stockLedger.ts) and read it
via [src/hooks/useProductStock.ts](../src/hooks/useProductStock.ts), never by adding a quantity
field back onto `Product`. This is the load-bearing design decision behind multi-device sync working
at all — see ARCHITECTURE.md.

| Store | Storage key | Backup field | Shape |
|---|---|---|---|
| `supplierStore.ts` | `supplier-store` | `suppliers` | `Supplier` — vendor contact info |
| `expenseStore.ts` | `expense-store` | `expenses` (+ `categories`, a separate persisted field on the same store) | `Expense` — date/category/amount/vendor; optionally linked to a product + `quantityAffected` when it represents a stock purchase |

## Vehicle service schedule

| Store | Storage key | Backup field | Shape |
|---|---|---|---|
| `serviceItemTypeStore.ts` | `service-item-type-store` | `serviceItemTypes` | `ServiceItemType` — the taxonomy of trackable items (oil, filter, transmission fluid…), seeded with 7 defaults, shop-editable after |
| `serviceCatalogStore.ts` | `service-catalog-store` | `serviceCatalog` | `ServiceCatalogItem` — the labor price list (the services counterpart to `Product`); optional `serviceItemTypeId` link and default reminder interval |
| `scheduleRuleStore.ts` | `schedule-rule-store` | `scheduleRules` | `ScheduleRule` — per-vehicle, per-item-type due interval (km and/or months); never edited in place, only superseded (`supersededAt`/`supersedesId` form an audit chain) |
| `serviceEventStore.ts` | `service-event-store` | `serviceEvents` | `ServiceEvent` — a record of what was actually done to a vehicle, generated from a completed `WorkOrder`, drives `ScheduleRule` forward |

## Scheduling & shop floor

| Store | Storage key | Backup field | Shape |
|---|---|---|---|
| `appointmentStore.ts` | `appointment-storage` | `appointments` | `Appointment` — scheduled or walk-in, links to a vehicle/customer/company, `status` lifecycle |
| `bayStore.ts` | `bay-storage` | `bays` | `Bay` — a physical service bay's live status, current work order, and assigned worker |

## Taxonomy & settings

| Store | Storage key | Backup field | Shape |
|---|---|---|---|
| `productCategoryStore.ts` | `product-category-store` | `productCategories` | `ProductCategory` — shop-editable, seeded with 7 defaults; `Product.category` stores the name directly (never renamed in a link-breaking way, unlike `ServiceItemType`) |
| `settingsStore.ts` | `settings-store` | `settings` | Shop name/address/phone/email, tax rate, receipt footer, default service interval |
| `securityStore.ts` | `security-store` | `security` | Admin/Worker access control: the admin password's PBKDF2 hash, the LAN sync token, and whether the LAN server requires it. A dedicated singleton, not fields on `settingsStore` — see the file's header comment for why a shared singleton would risk a stale device's unrelated edit silently reverting the admin password |
| `activityLogStore.ts` | `activity-log-store` | `activityLog` | `ActivityLogEntry` — append-only accountability log ("who deleted what"), written by Customers/Companies/Vehicles' delete handlers; `mode` + `deviceId` stand in for a per-user identity, since there are none. Settings' Activity Log card (`src/components/settings/ActivityLogCard.tsx`) merges these entries with `stockMovementStore`'s manual movements (`manualStockChanges` in `src/lib/stockLedger.ts`) into one accountability view — deletions and stock changes are two distinct sources, not one store |
| `languageStore.ts` | `language-store` | `language` | The UI language toggle (`en`/`id`) |

## Non-persisted stores (session-only)

Three stores intentionally have no `storage` config and aren't in `PERSISTED_STORES` — their state
describes *this browser tab right now*, not shop data, and should always start fresh:

- **`confirmStore.ts`** — the shared confirm-dialog queue.
- **`toastStore.ts`** — transient notifications.
- **`syncStatusStore.ts`** — the sync engine's live connection status (`idle`/`syncing`/`synced`/
  `offline`/`unauthorized`) — see ARCHITECTURE.md's sync section. Deliberately not persisted:
  yesterday's "offline" should never be remembered on launch.

`entityHelpers.ts` isn't a store at all — it's the shared factory (`newEntity`, `updateById`,
`removeById`, `touchById`, `findById`, `withExclusiveFlag`) nearly every entity store above is
built on.

## Sync-internal keys (not stores, not in `PERSISTED_STORES`)

A handful of keys live in the same underlying `key_value_store`/`localStorage` but are read and
written directly through `storageAdapter`, bypassing Zustand entirely — and are **deliberately kept
out of `PERSISTED_STORES`**, out of backups, and out of the sync registry:

- **`device-id`** ([src/lib/deviceId.ts](../src/lib/deviceId.ts)) — this device's own identity; a
  restored backup must never overwrite it.
- **`sync-host`** ([src/lib/sync/hostConfig.ts](../src/lib/sync/hostConfig.ts)) — which server this
  device follows. If this synced, the main device would push "I am the main device" to every
  follower and point them all at themselves.
- **`sync-outbox`**, **`sync-cursor`** ([src/lib/sync/outbox.ts](../src/lib/sync/outbox.ts),
  [src/lib/sync/engine.ts](../src/lib/sync/engine.ts)) — the sync engine's own queue and progress
  marker; writing to these must not itself be tracked as a change to sync (that would be infinite
  recursion).
- **`auth-mode`** ([src/store/authStore.ts](../src/store/authStore.ts)) — sticky Worker-mode marker
  for this device only, so a shop tablet doesn't ask again on every restart. Never holds `'admin'`
  — the admin session is memory-only and ends when the app closes. If this synced, one device
  entering Worker mode would flip every other device to Worker mode too.

See [docs/ARCHITECTURE.md](ARCHITECTURE.md) for why each of these has to stay outside the normal
store machinery.
