# Surya Baru — Service Console

A local-first desktop app for running an oil-change/vehicle-service shop: customer and vehicle
lookup, work orders, FIFO-costed inventory, expenses, and P&L reporting — with the same data kept
in sync across every device in the shop.

> Customer arrives → look up their vehicle (or add new) → create work order → assign technician →
> add services/products → complete & print receipt → inventory auto-deducts → see reports.

Runs 100% offline. Dark-only visual identity, single amber accent, Indonesian Rupiah + metric
(km, L) units throughout.

## Tech stack

| Layer | Technology |
|---|---|
| Desktop shell | Electron |
| Frontend | React + TypeScript |
| Styling | Tailwind CSS |
| Database | SQLite (sql.js, bridged synchronously through Electron IPC — see [src/lib/storageAdapter.ts](src/lib/storageAdapter.ts)) |
| State | Zustand |
| Routing | React Router |
| Multi-device sync | A small HTTP+SSE server (embedded in Electron, or standalone under Node) |

## Quick start

```bash
npm install

npm run dev            # Vite dev server only, in a plain browser tab (data in localStorage)
npm run electron:dev   # Vite dev server + the actual Electron shell (real SQLite)

npm test                # Vitest
npx tsc --noEmit         # Type-check

npm run build           # tsc + electron build + vite build + electron-builder installer
npm run package          # Build + package as an installer, without the top-level tsc pass
```

Editing `electron/main.ts`, `electron/preload.ts`, or anything under `server/`? Run
`npm run electron:build` afterward if you're not already going through `electron:dev`/`build`/
`package` (they run it for you). It compiles both `server/*.ts` → `dist-server/` and
`electron/*.ts` → `dist-electron/`, in that order — Electron's own main process requires the
compiled server output.

Running the sync server standalone, outside Electron entirely: `npm run server` (after
`npm run build:server`).

## What it does

1. **Customers** — individual customers with contact info
2. **Companies** — fleet/corporate accounts with multiple drivers
3. **Vehicles** — linked to a customer or company; engine, transmission, and gardan/differential specs
4. **Technicians** — shop workers
5. **Work Orders** — the main transaction record
6. **Inventory** — products with FIFO-costed stock tracking
7. **Suppliers** — vendor contact info
8. **Expenses** — manual expense entries, some linked to stock purchases
9. **Reports** — sales, P&L, analytics
10. **Appointments & Bays** — scheduling and bay-status board
11. **Multi-device sync** — every device (shop PC, tablets, an optional always-on server) sees the
    same data, inventory above all, with offline devices reconciling on reconnect

Oil-change shops are relationship-driven — customers return every 5,000–8,000 km. Fast vehicle
lookup and service history are the core value props.

## Project structure

```
├── electron/
│   ├── main.ts           # Electron main process — window lifecycle, IPC, embeds the sync server
│   └── preload.ts        # contextBridge + synchronous IPC bridge to the renderer
├── server/                # The sync server's implementation — embedded by electron/main.ts,
│                           # or run standalone via server/index.ts
├── src/
│   ├── App.tsx
│   ├── components/        # Reusable UI (ui/, dashboard/, workOrders/, inventory/, reports/, …)
│   ├── pages/              # One file per sidebar destination (src/pages/*.tsx)
│   ├── hooks/               # Custom React hooks
│   ├── lib/                  # Cross-store "ops" transactions, costing, sync engine, i18n, utilities
│   └── store/                # Zustand stores — the actual live data model
```

## Conventions

- TypeScript strict mode.
- Components in PascalCase, one file per component, filename matches the component name.
- All storage/persistence goes through [src/lib/storageAdapter.ts](src/lib/storageAdapter.ts) (the
  adapter) and is registered in [src/lib/persistence.ts](src/lib/persistence.ts) (backup/restore/
  clear-all, and what the sync engine watches) — no store or page touches storage directly.
- All money is stored as integers (whole Rupiah — IDR has no minor/cents unit in practice) to avoid
  floating-point issues.
- Dates are stored as ISO strings.
