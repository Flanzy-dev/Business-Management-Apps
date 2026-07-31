# Surya Baru — Service Console

A local-first desktop app for running an oil-change/vehicle-service shop: customer and vehicle
lookup, work orders, FIFO-costed inventory, expenses, and P&L reporting — running entirely offline
on one machine, with no network or account required.

> Customer arrives → look up their vehicle (or add new) → create work order → assign technician →
> add services/products → complete & print receipt → inventory auto-deducts → see reports.

Runs 100% offline. Dark-only visual identity, single amber accent, Indonesian Rupiah + metric
(km, L) units throughout — see [DESIGN.md](DESIGN.md) for the full design spec.

## Tech stack

| Layer | Technology |
|---|---|
| Desktop shell | Electron |
| Frontend | React + TypeScript |
| Styling | Tailwind CSS |
| Database | SQLite (sql.js, bridged synchronously through Electron IPC — see [src/lib/storageAdapter.ts](src/lib/storageAdapter.ts)) |
| State | Zustand |
| Routing | React Router |

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

Editing anything under `electron/`? Run `npm run electron:build` afterward if you're not already
going through `electron:dev`/`build`/`package` (they run it for you). It compiles
`electron/*.ts` → `dist-electron/`.

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

Oil-change shops are relationship-driven — customers return every 5,000–8,000 km. Fast vehicle
lookup and service history are the core value props; see [docs/USER_GUIDE.md](docs/USER_GUIDE.md)
for how shop staff actually use each of these day to day.

## Project structure

```
├── electron/
│   ├── main.ts           # Electron main process — window lifecycle, IPC
│   ├── db.ts             # The sql.js-backed SQLite database the main process owns
│   └── preload.ts        # contextBridge + synchronous IPC bridge to the renderer
├── src/
│   ├── App.tsx
│   ├── components/        # Reusable UI (ui/, dashboard/, workOrders/, inventory/, reports/, …)
│   ├── pages/              # One file per sidebar destination (src/pages/*.tsx)
│   ├── hooks/               # Custom React hooks
│   ├── lib/                  # Cross-store "ops" transactions, costing, i18n, utilities
│   └── store/                # Zustand stores — the actual live data model, see docs/DATA_MODEL.md
├── prisma/
│   └── schema.prisma        # A documented *possible future* relational shape — NOT wired to the app
└── docs/
```

## Documentation map

| Doc | Covers |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Conventions and phase plan for anyone (human or agent) working on this codebase |
| [DESIGN.md](DESIGN.md) | Visual spec — design tokens, component library, per-screen layouts |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How the pieces fit together: the storage seam, the ops layer, FIFO costing |
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md) | The data model as it actually runs today (the 23 Zustand stores), as opposed to `prisma/schema.prisma`'s aspirational one |
| [docs/USER_GUIDE.md](docs/USER_GUIDE.md) | For shop staff — no code, just how to use the app |
| [docs/architecture-vault/](docs/architecture-vault/) | Auto-generated import-graph notes (one file per module) — a supplementary map, not authoritative; see `_Architecture Overview.md` |

## Conventions

- TypeScript strict mode.
- Components in PascalCase, one file per component, filename matches the component name.
- All storage/persistence goes through [src/lib/storageAdapter.ts](src/lib/storageAdapter.ts) (the
  adapter) and is registered in [src/lib/persistence.ts](src/lib/persistence.ts) (the backup/
  restore/clear-all registry) — no store or page touches storage directly.
- All money is stored as integers (whole Rupiah — IDR has no minor/cents unit in practice) to avoid
  floating-point issues.
- Dates are stored as ISO strings.
