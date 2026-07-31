# Graph Report - .  (2026-07-13)

## Corpus Check
- 166 files · ~50,800 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 492 nodes · 1121 edges · 28 communities (26 shown, 2 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 16 edges (avg confidence: 0.75)
- Token cost: 0 input · 81,000 output

## Community Hubs (Navigation)
- Work Orders, Receipt & Search
- Reports & P&L Charts
- Domain Concepts & Design Spec
- Deletion Policy & Entity Ops
- App Shell & Entity Pages
- Runtime Dependencies
- Build / Dev Dependencies
- TypeScript Config
- Dashboard Charts
- Layout & Buttons
- Badges & Vehicle Validators
- Order Lifecycle & Completion
- Cards, Profile & Settings
- Dashboard Rails & Tables
- Vite / Node Build Config
- Persistence & Backup
- Stat Cards & Tiles
- Tooling Config (Fallow/Preload)
- Form Inputs
- Bay Status Board
- Tabs Component
- Electron Main Process
- Electron Preload Bridge

## God Nodes (most connected - your core abstractions)
1. `react` - 29 edges
2. `formatCurrency()` - 24 edges
3. `useCustomerStore` - 20 edges
4. `useVehicleStore` - 20 edges
5. `useWorkOrderStore` - 19 edges
6. `WorkOrders()` - 18 edges
7. `compilerOptions` - 18 edges
8. `PnlReport()` - 17 edges
9. `useToastStore` - 17 edges
10. `useCompanyStore` - 16 edges

## Surprising Connections (you probably didn't know these)
- `New Service Order Dialog` --conceptually_related_to--> `Work Order Lifecycle`  [INFERRED]
  DESIGN.md → CLAUDE.md
- `Auto-Clear Bay on Order Completion` --conceptually_related_to--> `Work Order Lifecycle`  [EXTRACTED]
  plans/03-bay-management.md → CLAUDE.md
- `COGS at Current Cost Prices` --conceptually_related_to--> `Inventory Auto-Deduct`  [INFERRED]
  plans/01-finish-pnl-reports.md → CLAUDE.md
- `Appointment Store & Scheduling` --shares_data_with--> `Fleet / Company Accounts`  [EXTRACTED]
  plans/04-appointments-form.md → CLAUDE.md
- `Rupiah + Metric Units Convention` --conceptually_related_to--> `Money as Integer Whole Rupiah`  [INFERRED]
  DESIGN.md → CLAUDE.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Shared Sunday-start half-open date-range pattern** — plans_01_finish_pnl_reports_getperiodrange, plans_04_appointments_form_walkin_queue, plans_01_finish_pnl_reports_timezone_safety [INFERRED 0.75]
- **Work order completion drives inventory deduction and bay clearing** — claude_work_order_lifecycle, claude_inventory_auto_deduct, plans_03_bay_management_auto_clear [INFERRED 0.85]
- **All persisted Zustand stores covered by backup/restore** — claude_zustand_stores, plans_02_backup_completeness_backup_restore, plans_03_bay_management_bay_store, plans_04_appointments_form_appointment_store [INFERRED 0.85]

## Communities (28 total, 2 thin omitted)

### Community 0 - "Work Orders, Receipt & Search"
Cohesion: 0.09
Nodes (49): GlobalSearch(), GlobalSearchProps, SearchResult, escapeHtml(), formatDate(), formatTime(), printReceipt(), Receipt() (+41 more)

### Community 1 - "Reports & P&L Charts"
Cohesion: 0.09
Nodes (43): ExpenseCategoryBar(), ExpenseCategoryBarProps, METHOD_META, PaymentMethodBreakdown(), PaymentMethodBreakdownProps, formatPct(), PERIOD_LABEL, PnlReport() (+35 more)

### Community 2 - "Domain Concepts & Design Spec"
Cohesion: 0.05
Nodes (46): Fleet / Company Accounts, Inventory Auto-Deduct, Money as Integer Whole Rupiah, Offline Electron + React + SQLite Stack, Reports Module (Sales, P&L, Analytics), Surya Baru Service Console (App), Vehicle Service History, Vehicle Engine/Transmission/Gardan Specs (+38 more)

### Community 3 - "Deletion Policy & Entity Ops"
Cohesion: 0.12
Nodes (28): companyDeletionBlocker(), customerDeletionBlocker(), DeletionBlocker, plural(), productDeletionBlocker(), productsToDetachFromSupplier(), vehicleDeletionBlocker(), workerDeletionBlocker() (+20 more)

### Community 4 - "App Shell & Entity Pages"
Cohesion: 0.10
Nodes (23): App(), DropdownMenu(), DropdownMenuItem, DropdownMenuProps, ToastHost(), toneDotClass, deleteSupplierDetaching(), Companies() (+15 more)

### Community 5 - "Runtime Dependencies"
Cohesion: 0.06
Nodes (32): lucide-react, author, dependencies, lucide-react, @prisma/client, react, react-dom, react-router-dom (+24 more)

### Community 6 - "Build / Dev Dependencies"
Cohesion: 0.07
Nodes (29): autoprefixer, concurrently, electron, electron-builder, devDependencies, autoprefixer, concurrently, electron (+21 more)

### Community 7 - "TypeScript Config"
Cohesion: 0.08
Nodes (25): DOM, DOM.Iterable, ES2020, src/*, compilerOptions, allowImportingTsExtensions, baseUrl, isolatedModules (+17 more)

### Community 8 - "Dashboard Charts"
Cohesion: 0.14
Nodes (13): AppointmentTrendChart(), AppointmentTrendChartProps, TrendData, BayCapacityGauge(), BayCapacityGaugeProps, severityColor(), BayThroughputChart(), BayThroughputChartProps (+5 more)

### Community 9 - "Layout & Buttons"
Cohesion: 0.14
Nodes (14): Layout(), navigation, routeTitles, Button, ButtonProps, ButtonSize, ButtonVariant, sizeStyles (+6 more)

### Community 10 - "Badges & Vehicle Validators"
Cohesion: 0.18
Nodes (14): Badge(), BadgeProps, BadgeTone, StatusBadge(), StatusBadgeProps, statusToneMap, toneStyles, formatLicensePlate() (+6 more)

### Community 11 - "Order Lifecycle & Completion"
Cohesion: 0.25
Nodes (11): completeOrder(), CompleteOrderResult, deleteOrder(), applyCompletion(), CompletionResult, deletionStockRestorations(), StockAdjustment, stockDeltas() (+3 more)

### Community 12 - "Cards, Profile & Settings"
Cohesion: 0.28
Nodes (9): react, Card(), CardContent(), CardHeader(), CardProps, CardTitle(), paddingMap, ShopInfo (+1 more)

### Community 13 - "Dashboard Rails & Tables"
Cohesion: 0.19
Nodes (9): LowStockItem, LowStockRail(), LowStockRailProps, ServiceMixItem, ServiceMixTable(), ServiceMixTableProps, TechnicianData, TechnicianQueue() (+1 more)

### Community 14 - "Vite / Node Build Config"
Cohesion: 0.18
Nodes (10): vite.config.ts, compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, skipLibCheck, strict (+2 more)

### Community 15 - "Persistence & Backup"
Cohesion: 0.22
Nodes (9): applyBackup(), clearAllData(), collectBackup(), PERSISTED_STORES, Settings(), defaultSettings, Settings, SettingsStore (+1 more)

### Community 16 - "Stat Cards & Tiles"
Cohesion: 0.29
Nodes (6): DeltaTone, deltaToneClass, StatCard(), StatCardProps, SunkenTile(), SunkenTileProps

### Community 17 - "Tooling Config (Fallow/Preload)"
Cohesion: 0.29
Nodes (6): dynamicallyLoaded, ignorePatterns, $schema, dist/**, dist-electron/**, electron/preload.ts

### Community 18 - "Form Inputs"
Cohesion: 0.29
Nodes (6): Input, InputProps, Select, SelectProps, Textarea, TextareaProps

### Community 19 - "Bay Status Board"
Cohesion: 0.40
Nodes (4): BayData, BayStatusBoard(), BayStatusBoardProps, STATUS_CONFIG

### Community 20 - "Tabs Component"
Cohesion: 0.50
Nodes (4): normalize(), TabItem, Tabs(), TabsProps

## Knowledge Gaps
- **164 isolated node(s):** `$schema`, `dist-electron/**`, `dist/**`, `electron/preload.ts`, `{ app, BrowserWindow, ipcMain }` (+159 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `Cards, Profile & Settings` to `Work Orders, Receipt & Search`, `Reports & P&L Charts`, `App Shell & Entity Pages`, `Runtime Dependencies`, `Layout & Buttons`, `Badges & Vehicle Validators`, `Dashboard Rails & Tables`, `Stat Cards & Tiles`, `Form Inputs`?**
  _High betweenness centrality (0.254) - this node is a cross-community bridge._
- **Why does `keywords` connect `Runtime Dependencies` to `Cards, Profile & Settings`?**
  _High betweenness centrality (0.168) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `Build / Dev Dependencies` to `Runtime Dependencies`?**
  _High betweenness centrality (0.087) - this node is a cross-community bridge._
- **What connects `$schema`, `dist-electron/**`, `dist/**` to the rest of the system?**
  _164 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Work Orders, Receipt & Search` be split into smaller, more focused modules?**
  _Cohesion score 0.09465891062929667 - nodes in this community are weakly interconnected._
- **Should `Reports & P&L Charts` be split into smaller, more focused modules?**
  _Cohesion score 0.08831168831168831 - nodes in this community are weakly interconnected._
- **Should `Domain Concepts & Design Spec` be split into smaller, more focused modules?**
  _Cohesion score 0.05217391304347826 - nodes in this community are weakly interconnected._