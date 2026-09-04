# Domain glossary

The vocabulary this codebase uses for its own domain — not a UI glossary, not a
restatement of `docs/DATA_MODEL.md`'s field tables. Each term names a concept that
shows up in code, comments, and conversation about this app; the owning module is
where its actual shape and rules live. If this file and the code disagree, the code
is correct — file an update here.

- **Work order** — the shop's main transaction record (`src/store/workOrderStore.ts`).
  One vehicle, one set of line items, one total. Never written to directly for
  completion or deletion — see **ops layer** below.
- **Stock lot** — one row per stock *arrival* (`src/store/stockLotStore.ts`), recording
  what that specific batch actually cost. Never edited or deleted.
- **Stock movement** — one row per stock *quantity change* — a sale, a purchase, a
  reversal, a manual adjustment (`src/store/stockMovementStore.ts`). Signed, append-only.
  A product's quantity on hand is never a stored counter; it is always `Σ delta` over
  its movements (`src/lib/stockLedger.ts`). This is the decision that makes multi-device
  sync safe: two offline sales of the same product are two movements, and a merge keeps
  both, where two writes to one `qtyOnHand` field would silently lose one.
- **FIFO costing** — when stock leaves, `src/lib/inventoryCosting.ts`'s `drawFifo` draws
  from the oldest lot first. The cost consumed is frozen onto the work order's line item
  as `costOfGoods` at completion, so editing a product's cost price later can never move
  a past P&L.
- **Service event** — a record of what was actually done to a vehicle
  (`src/store/serviceEventStore.ts`), generated from a completed work order. Drives the
  vehicle's due-service schedule forward.
- **Schedule rule** — a per-vehicle, per-service-item-type due interval, in km and/or
  months (`src/store/scheduleRuleStore.ts`). Never edited in place — a change
  *supersedes* the old rule (`supersededAt`/`supersedesId`), preserving an audit chain
  of what the due interval used to be.
- **Service item type** — the taxonomy of trackable service items (engine oil, oil
  filter, transmission fluid, gardan oil, …), seeded with 7 defaults and shop-editable
  after (`src/store/serviceItemTypeStore.ts`). What schedule rules and service events are
  keyed on.
- **Bay** — a physical service bay's live status: which work order occupies it, which
  worker is assigned, and an estimated end time (`src/store/bayStore.ts`).
- **Driver** — a fleet company's individual driver, embedded inside that `Company`
  record rather than a separate store — a driver doesn't exist independent of the
  company account they drive for.
- **Gardan** — the differential (Indonesian automotive term). A vehicle tracks gardan
  fluid the same way it tracks engine and transmission fluid: type + required amount.
- **"Modal" (supplier) code** — a `Product`'s `supplierCode` field: the code on a
  supplier's price list, which typically encodes the shop's cost ("modal" = capital/
  cost in Indonesian). Uppercase by convention but **not** unique — unlike `sku`, the
  shop's own product code, which is unique when set.
- **Worker mode / Admin mode** — the app's two access levels, not per-user accounts.
  Worker mode is one-tap, no password, sticky per device. Admin mode is password-gated,
  memory-only, and ends on app close or 15 minutes idle. See
  `src/lib/auth/permissions.ts` for the single predicate module every route guard,
  nav filter, and keyboard shortcut consults.
- **Main / follower** — which sync role a device plays (`src/lib/sync/hostConfig.ts`).
  `main` serves from wherever the device itself loaded from; `follower` always talks to
  a configured remote host instead. See `docs/ARCHITECTURE.md`'s sync section for the
  full protocol.
- **Ops layer** (`src/lib/ops/*`) — the seam between pages and stores for anything that
  spans more than one store or carries a business rule: completing/voiding/deleting a
  work order, checked deletes, stock changes with a cash-flow side. A `create*Ops(deps)`
  factory takes an injectable `OpsDeps` (see `src/lib/ops/deps.ts`) so ops are testable
  without booting real stores.

See also `docs/DATA_MODEL.md` for the full store-by-store field reference and
`docs/ARCHITECTURE.md` for why things are shaped the way they are.
