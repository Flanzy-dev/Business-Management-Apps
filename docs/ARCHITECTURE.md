# Architecture

How the pieces of Surya Baru fit together. For "what does this specific module import," see
[docs/architecture-vault/](architecture-vault/) — an auto-generated import graph. This document is
the opposite: hand-written prose about *why* things are shaped the way they are, which a generated
graph can't tell you. See also [CLAUDE.md](../CLAUDE.md) for conventions and
[docs/DATA_MODEL.md](DATA_MODEL.md) for what's actually stored.

## Layers

The app is a strict layered dependency flow — imports only point downward:

```
Shell (main → App → Layout)
   │
Pages (one per sidebar destination, src/pages/*.tsx)
   │        ╲
Widgets    Ops / Domain Logic  (src/lib/ops/*, deletionPolicy, orderLifecycle)
 (dashboard/reports/ui)      │
   │        ╱                 │
Lib / Utilities (currency, dates, entities, finance, units, i18n…)
   │
Stores (Zustand, src/store/*.ts) — the data foundation
```

(This is the vault's own framing — see `docs/architecture-vault/_Architecture Overview.md` — cited
here because it's correct, not reproduced because it's stale: that file currently lists 13 stores,
16 pages, and 4 ops modules; the live counts are 21, 17, and considerably more. Trust the code over
either document when they disagree.)

## The storage seam

Every persisted Zustand store passes `storage: createJSONStorage(getStorageAdapter)`
([src/lib/storageAdapter.ts](../src/lib/storageAdapter.ts)). That one file is the entire boundary
between "the app persists data" and "where that data lives":

- **`localStorageAdapter`** — plain browser `localStorage`. Used by `npm run dev` and Vitest.
- **`electronSqliteAdapter`** — real SQLite, reached via synchronous IPC
  (`ipcRenderer.sendSync` in `electron/preload.ts` → `electron/main.ts`). Used by the packaged/dev
  Electron shell. The whole database is one generic `key_value_store` table — every store's state
  is a single JSON blob under its own key.

`storageAdapter` picks whichever applies at runtime.

[src/lib/persistence.ts](../src/lib/persistence.ts)'s `PERSISTED_STORES` registry is the second
half of the seam: every store that persists must be listed there (`storageKey` + `backupField`).
Settings' backup/restore/clear-all iterates it — a store left out of `PERSISTED_STORES` would
silently be missing from backups.

## The ops layer

Pages don't call store actions directly for anything that spans more than one store or has a
business rule attached — they call into `src/lib/ops/*` instead. Representative examples:

- **`entityOps.ts`** — checked deletes (`deleteProductChecked`, etc.) that consult
  `deletionPolicy.ts` before removing a row a work order, vehicle, or another store still
  references.
- **`orderOps.ts`** — completing or deleting a work order: draws FIFO stock, appends ledger
  movements, freezes costs onto the order's line items, and (on delete) reverses all of it via
  `orderLifecycle.ts`'s deduct-once/restore-once invariant.
- **`inventoryOps.ts`** — stock changes that also represent real cash flow (`restockProduct`,
  `createProduct`, `recordExpense`, `reconcileStock`) — keeping a stock addition and its linked
  expense from ever drifting apart.

This is the seam that isolates business rules from UI, and the reason a page component should
generally look thin: real logic lives in `lib/ops`, not in a `.tsx` file's event handlers.

## FIFO inventory costing

Stock quantity is **not** a stored counter — it's derived from an append-only ledger:

- **`StockLot`** ([src/store/stockLotStore.ts](../src/store/stockLotStore.ts)) — one row per stock
  arrival, recording what that specific batch actually cost.
- **`StockMovement`** ([src/store/stockMovementStore.ts](../src/store/stockMovementStore.ts)) —
  one row per quantity change (`sale`, `purchase`, `adjustment`, reversals…), signed, **never
  edited or deleted**. Current quantity on hand is always `Σ delta` — see
  [src/lib/stockLedger.ts](../src/lib/stockLedger.ts).
- **`inventoryCosting.ts`**'s `drawFifo` consumes the oldest lot first when stock leaves.
- When a work order completes, the cost of the stock it consumed is frozen onto the line as
  `WorkOrderItem.costOfGoods` — editing a product's cost price later can never move a past P&L.

The ledger being append-only (never mutated) is deliberate, not incidental: it's the honest record
of what happened even after a correction — `inventoryOps.ts`'s `reconcileStock` appends an
offsetting adjustment rather than rewriting history.

## Where things aren't wired up

`prisma/schema.prisma` documents a *possible future* relational shape (real per-entity tables, for
actual SQL joins beyond in-memory filtering) but nothing in the running app touches
`PrismaClient`/`@prisma/client`. See [docs/DATA_MODEL.md](DATA_MODEL.md) for the model that's
actually live.
