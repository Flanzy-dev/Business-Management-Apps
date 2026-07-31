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
Lib / Utilities (currency, dates, entities, finance, units, sync, i18n…)
   │
Stores (Zustand, src/store/*.ts) — the data foundation
```

(This is the vault's own framing — see `docs/architecture-vault/_Architecture Overview.md` — cited
here because it's correct, not reproduced because it's stale: that file currently lists 13 stores,
16 pages, and 4 ops modules; the live counts are 23, 17, and considerably more. Trust the code over
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

`storageAdapter` picks whichever applies at runtime and exposes one more thing:
`onStorageSetItem(listener)` — a hook that fires on every write, seeing the value before and after.
This is what the multi-device sync tracker listens on (see below); no store had to change to make
sync possible.

[src/lib/persistence.ts](../src/lib/persistence.ts)'s `PERSISTED_STORES` registry is the second
half of the seam: every store that persists must be listed there (`storageKey` + `backupField`).
Settings' backup/restore/clear-all, and the sync engine's store registry
([src/lib/sync/storeRegistry.ts](../src/lib/sync/storeRegistry.ts)), both iterate it — a store left
out of `PERSISTED_STORES` would silently be missing from backups and invisible to sync.

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

The ledger being append-only (never mutated) is deliberate, not incidental: it's what makes
multi-device merging safe (see below) — two devices each recording "-1" for the same product both
survive a merge, where two devices each writing "set to 4" would silently lose one of them.

## Multi-device sync

The goal: every device in the shop sees the same data — inventory above all — while staying
usable if the WiFi drops, reconciling on reconnect.

**Where the server runs.** The actual store + HTTP/SSE server
([server/db.ts](../server/db.ts) + [server/syncServer.ts](../server/syncServer.ts)) has exactly two
deployments, sharing one implementation so they can't drift apart:
- **Embedded in Electron** ([electron/main.ts](../electron/main.ts)) — every shop PC running the
  desktop app runs this on port 5174, backed by the same SQLite file the app itself uses.
- **Standalone** ([server/index.ts](../server/index.ts)) — `node dist-server/index.js`, for an
  always-on machine that isn't a shop PC. See [docs/ubuntu-server.md](ubuntu-server.md).

**Which server a device talks to.** [src/lib/sync/hostConfig.ts](../src/lib/sync/hostConfig.ts)
stores a device-local `{role, host, token}` — deliberately outside `PERSISTED_STORES`/
`storeRegistry.ts` and out of backups (see `docs/DATA_MODEL.md`'s sync-internal-keys note for why).
`role: 'main'` resolves to wherever the page itself loaded from (a shop PC's own server, or
whatever a tablet bookmarked); `role: 'follower'` with a `host` always talks to that address
instead.

**Switching hosts.** [src/lib/sync/engine.ts](../src/lib/sync/engine.ts)'s `switchHost()` makes a
device **adopt** a different remote host's data: it clears the outbox, wipes local stores, resets
its cursor, and rejoins cold — the new host's snapshot becomes this device's data. That wipe is
deliberately conditional (`adoptingRemote` in the code): switching back to `role: 'main'` must
*not* wipe first, because on a shop PC `storageAdapter` and the embedded server share one SQLite
file — wiping before a self-referential rejoin would have destroyed the only copy of the data it
was about to read back. If you touch this function, preserve that distinction; it's a one-line
condition guarding against real data loss, not defensive boilerplate.

**The sync loop, once connected.** `src/lib/sync/`:
- **`tracker.ts`** listens on `storageAdapter`'s `onStorageSetItem` hook and, for every registered
  sync unit, diffs the previous/next blob (`diff.ts`) into ops.
- **`outbox.ts`** queues those ops (persisted, so a refresh mid-offline loses nothing) until
  **`client.ts`** can push them.
- The server assigns each accepted op a monotonic `seq` — the single total order every device
  converges on — and broadcasts an SSE "something changed" ping to every connected device.
- Each device pulls everything after its last-seen `seq` and applies it via **`merge.ts`**:
  **whole-record, last-write-wins by `seq`** (not wall-clock time — no clock-skew handling needed).
  This granularity was a deliberate choice over per-field merging: simpler and fully deterministic,
  traded off against the rare case of two devices editing different fields of the same record while
  both offline.
- A device with nothing local yet (or one that just switched hosts) skips replay entirely and pulls
  a full `/api/snapshot` instead — `engine.ts`'s `joinCold`.

**Auth.** An optional shared `SHOP_TOKEN` on a server gates every `/api/*` call
(`x-shop-token` header; `?token=` for the SSE route, since `EventSource` can't set headers). Unset
by default on the embedded shop-PC server, so existing single-PC setups are unaffected.

## Where things aren't wired up

`prisma/schema.prisma` documents a *possible future* relational shape (real per-entity tables, for
actual SQL joins beyond in-memory filtering) but nothing in the running app touches
`PrismaClient`/`@prisma/client`. See [docs/DATA_MODEL.md](DATA_MODEL.md) for the model that's
actually live.
