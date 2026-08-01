# Agent Instructions — Surya Baru Service Console

You're building a **local desktop application** for managing an oil-change/vehicle-service business.
The app runs 100% offline using **Electron** for the desktop shell and **SQLite** for local data
storage. The product is branded **Surya Baru** — a dark-only visual identity with a single amber
accent, Space Grotesk/IBM Plex fonts, and Indonesian Rupiah + metric (km, L) units throughout;
see `DESIGN.md` for the full design spec.

## What this app does

A complete shop management system:

> Customer arrives → look up their vehicle (or add new) → create work order → assign technician →
> add services/products → complete & print receipt → inventory auto-deducts → see reports.

Key insight: Oil change shops are relationship-driven — customers return every 5,000-8,000 km.
Fast vehicle lookup and service history are the core value props.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Desktop shell | Electron |
| Frontend | React + TypeScript |
| Styling | Tailwind CSS |
| Database | SQLite (sql.js, bridged synchronously through Electron IPC — see `src/lib/storageAdapter.ts`) |
| State | Zustand |
| Routing | React Router |

## Project Structure

```
surya-baru/
├── package.json
├── electron/
│   ├── main.ts           # Electron main process (owns the sql.js SQLite connection)
│   └── preload.ts        # Bridge to renderer (contextBridge + synchronous IPC for db access)
├── src/
│   ├── App.tsx
│   ├── components/       # Reusable UI components
│   ├── pages/            # Dashboard, WorkOrder, Customers, etc.
│   ├── hooks/            # Custom React hooks
│   ├── store/            # Zustand stores
│   ├── lib/              # Database queries, utilities
│   └── types/            # TypeScript types
├── prisma/
│   └── schema.prisma     # Database schema
└── resources/            # Icons, assets
```

## Core Modules

1. **Customers** — individual customers with contact info
2. **Companies** — fleet/corporate accounts with multiple drivers
3. **Vehicles** — linked to customer or company, includes engine/transmission/gardan specs
4. **Workers** — shop technicians
5. **Work Orders** — the main transaction record
6. **Inventory** — products with stock tracking
7. **Suppliers** — vendor contact info
8. **Expenses** — manual expense entries
9. **Reports** — sales, P&L, analytics

## Database

SQLite database stored locally at `app.getPath('userData')/surya-baru.db`, owned by the Electron
main process via `sql.js` (WASM SQLite — chosen over a native module or Prisma so there's no
node-gyp rebuild step and the renderer bridge can stay fully synchronous). It backs a single
generic `key_value_store` table: every Zustand `persist` store (see `src/store/*.ts` and the
registry in `src/lib/persistence.ts`) is stored as one JSON blob per key, reached through
`src/lib/storageAdapter.ts` → `electron/preload.ts` (`ipcRenderer.sendSync`) →
`electron/main.ts`. No store or page code touches storage directly.

`prisma/schema.prisma` documents a possible future *relational* shape (real per-entity tables,
needed for actual SQL queries/joins beyond in-memory filtering) but is **not** wired to the
running app — do not assume `PrismaClient`/`@prisma/client` calls do anything.

Running outside Electron (`npm run dev`, or Vitest) falls back to plain browser `localStorage`
automatically — see `storageAdapter.ts`.

Vehicles track: make, model, year, VIN, plate, plus engine info (type, size, oil required),
transmission info (type, fluid), and gardan/differential info (drive type, fluid).

**Inventory costing is FIFO.** Every stock arrival opens a `StockLot`
(`src/store/stockLotStore.ts`) recording what that batch actually cost, and a sale draws from the
oldest lots first (`src/lib/inventoryCosting.ts`). When an order completes, the cost of the stock it
consumed is frozen onto the line as `WorkOrderItem.costOfGoods`, so editing a product's cost price
later can never move a past P&L. `Product.costPrice` is now only the default for stock that arrives
with no purchase recorded, and the fallback for lines sold before lot costing existed.

## How to Operate

**1. Run the app in development:**
```bash
npm run dev          # Vite dev server only, in a plain browser tab (localStorage)
npm run electron:dev # Vite dev server + the actual Electron shell (real SQLite)
```

**2. Electron main/preload changes:**
```bash
npm run electron:build    # Compile electron/*.ts -> dist-electron/*.js (tsconfig.electron.json)
```
`electron:dev`, `build`, and `package` all run this automatically; run it manually after editing
`electron/main.ts` or `electron/preload.ts` if you're not going through one of those scripts.

**3. Build for production:**
```bash
npm run build        # Build the app
npm run package      # Package as installer
```

## Implementation Phases

### Phase 1: Foundation (current)
- [ ] Electron + React + TypeScript + Vite setup
- [ ] Prisma + SQLite database
- [ ] Database schema (all tables)
- [ ] Basic navigation shell (sidebar)
- [ ] Settings page with data backup

### Phase 2: Core Entities
- [ ] Customer CRUD
- [ ] Company/fleet CRUD
- [ ] Driver management
- [ ] Vehicle CRUD (with engine/transmission/gardan)
- [ ] Worker management

### Phase 3: Core Workflow
- [ ] Work order creation
- [ ] Assign worker, select vehicle
- [ ] Add line items from inventory
- [ ] Complete & print receipt
- [ ] Service history

### Phase 4: Inventory & Suppliers
- [ ] Supplier management
- [ ] Product management
- [ ] Stock tracking (auto-deduct)
- [ ] Low stock alerts

### Phase 5: Financials & Reports
- [ ] Expense tracking
- [ ] Sales reports
- [ ] P&L report
- [ ] Customer/worker analytics

### Phase 6: Polish
- [ ] Receipt printing
- [ ] Keyboard shortcuts
- [ ] UI polish

## Conventions

- Use TypeScript strict mode
- Components in PascalCase, files match component name
- Storage/persistence code goes in `src/lib/storageAdapter.ts` (the adapter) and `src/lib/persistence.ts` (the backup/restore/clear-all registry) — see the `## Database` section above
- Zustand stores in `src/store/`
- All money stored as integers (whole Rupiah — IDR has no minor/cents unit in practice) to avoid floating point issues
- Dates stored as ISO strings

## File Locations

| What | Where |
|------|-------|
| Plan | `business-management-plan.txt` |
| Storage adapter (real database bridge) | `src/lib/storageAdapter.ts` |
| Database schema (documented target shape, not yet wired) | `prisma/schema.prisma` |
| Main process (owns the SQLite connection) | `electron/main.ts` |
| React entry | `src/main.tsx` |
| Pages | `src/pages/` |
| Components | `src/components/` |
