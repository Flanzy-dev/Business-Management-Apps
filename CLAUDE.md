# Agent Instructions — Oil Change Shop Management App

You're building a **local desktop application** for managing an oil change business. The app runs
100% offline using **Electron** for the desktop shell and **SQLite** for local data storage.

## What this app does

A complete shop management system:

> Customer arrives → look up their vehicle (or add new) → create work order → assign technician →
> add services/products → complete & print receipt → inventory auto-deducts → see reports.

Key insight: Oil change shops are relationship-driven — customers return every 3-5k miles.
Fast vehicle lookup and service history are the core value props.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Desktop shell | Electron |
| Frontend | React + TypeScript |
| Styling | Tailwind CSS |
| Database | SQLite (via Prisma) |
| State | Zustand |
| Routing | React Router |

## Project Structure

```
oil-change-app/
├── package.json
├── electron/
│   ├── main.ts           # Electron main process
│   ├── preload.ts        # Bridge to renderer
│   └── database.ts       # SQLite connection
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

SQLite database stored locally. Schema managed with Prisma. Key tables:
- `customers`, `companies`, `drivers`, `vehicles`, `workers`
- `products`, `suppliers`
- `work_orders`, `work_order_items`
- `expenses`, `settings`

Vehicles track: make, model, year, VIN, plate, plus engine info (type, size, oil required),
transmission info (type, fluid), and gardan/differential info (drive type, fluid).

## How to Operate

**1. Run the app in development:**
```bash
npm run dev          # Start Vite dev server + Electron
```

**2. Database changes:**
```bash
npx prisma migrate dev    # Create/apply migrations
npx prisma generate       # Regenerate client after schema changes
npx prisma studio         # GUI to browse data
```

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
- Database queries go in `src/lib/db/`
- Zustand stores in `src/store/`
- All money stored as integers (cents) to avoid floating point issues
- Dates stored as ISO strings in SQLite

## File Locations

| What | Where |
|------|-------|
| Plan | `business-management-plan.txt` |
| Database schema | `prisma/schema.prisma` |
| Main process | `electron/main.ts` |
| React entry | `src/main.tsx` |
| Pages | `src/pages/` |
| Components | `src/components/` |
