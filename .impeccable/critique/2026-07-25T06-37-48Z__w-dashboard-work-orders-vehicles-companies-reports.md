---
target: "whole app (core workflow: Dashboard, Work Orders, Vehicles, Companies, Reports)"
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
timestamp: 2026-07-25T06-37-48Z
slug: w-dashboard-work-orders-vehicles-companies-reports
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3/4 | Toasts/progress bars are good; completing a paid order gives zero in-app confirmation |
| 2 | Match System / Real World | 3/4 | Strong domain vocabulary undercut by cash/card/check payment set (no QRIS) and English-only backend error strings |
| 3 | User Control and Freedom | 3/4 | Cancel/Escape solid throughout; no undo beyond confirm dialogs |
| 4 | Consistency and Standards | 2/4 | Two parallel token vocabularies; NewWorkOrderDialog/WorkOrderEditor hand-roll inputs instead of reusing Input/Select; Reports reimplements Tabs |
| 5 | Error Prevention | 3/4 | Stock/reference-integrity guards present; one dead fallback-toast path found |
| 6 | Recognition Rather Than Recall | 2/4 | Double-click-to-edit has zero visual affordance; BayStatusBoard tiles fake interactivity (cursor-pointer, no onClick) |
| 7 | Flexibility and Efficiency | 2/4 | Ctrl+N and Ctrl+3 both just navigate to /work-orders; owner lookup in New Order is a plain unsearchable select despite GlobalSearch's fuzzy search existing elsewhere |
| 8 | Aesthetic and Minimalist Design | 3/4 | Disciplined single-accent token system, mostly honored; Dashboard has grown to 9 stacked sections |
| 9 | Error Recovery | 2/4 | Toasts used well, but several ops-layer error strings are raw untranslated English |
| 10 | Help and Documentation | 2/4 | No tooltips/inline help anywhere; shortcuts and double-click edit are undocumented in-app |
| **Total** | | **25/40** | **Acceptable** |

## Audit Health Score

| # | Dimension | Score | Key Finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 2/4 | `--fg-3` (#5f6d80) computes to ~3.5:1 against `--bg-1`, below WCAG AA's 4.5:1 — baked into DESIGN.md's own token, used for form labels/hints app-wide |
| 2 | Performance | 2/4 | No memoization on chart components; broad (non-selector) Zustand subscriptions on Vehicles/Companies/Customers; zero virtualization anywhere |
| 3 | Responsive Design | 3/4 | Desktop window (min 1024×700) degrades gracefully via overflow-scroll tables and a manual sidebar-collapse escape hatch |
| 4 | Theming | 4/4 | This session's opacity-modifier fix verified complete; zero stray hex/rgba outside Receipt.tsx print HTML and a code comment |
| 5 | Implementation Integrity | 0/4 | CLAUDE.md and package.json document "SQLite via Prisma"; zero `PrismaClient` usage anywhere in the codebase. Runtime persistence is `localStorage` via Zustand `persist`, confirmed in `storageAdapter.ts` and `persistence.ts` (16 stores, i.e. the entire app's data) |
| **Total** | | **11/20** | **Acceptable** |

## Implementation Integrity Verdict — FAIL

Both assessments converge here from different angles. The technical audit (Assessment B) independently re-verified, via its own greps and file reads, that `prisma/schema.prisma` exists but is never imported (`PrismaClient`/`@prisma/client` — zero matches across `src/` and `electron/`), and that the schema's own header comment admits it is disconnected from the running app. Every one of the app's 16 persisted stores (customers, vehicles, work orders, inventory, expenses, etc. — the entirety of the business's data) actually lives in browser `localStorage` via `src/lib/storageAdapter.ts`. `electron/main.ts` has no database IPC bridge at all, just a single `get-app-path` handler.

This is a real, business-relevant gap, not documentation drift alone: `localStorage` has a practical ~5-10MB per-origin ceiling, no query capability (every list is a full in-memory `.filter()`), no relational integrity beyond hand-written app logic, and no capacity monitoring. For a shop explicitly modeled around "customers return every 5,000-8,000 km" and accumulating years of transaction history, this is a slow-motion failure mode with no warning path today. `persistence.ts`'s JSON export/import backup is a reasonable safety net against accidental loss, but doesn't address size, query, or integrity.

The 4 deterministic `side-tab` (`border-l-*`) detector findings, by contrast, were verified false positives on inspection — each ties to a real semantic state (toast tone, low-stock severity, a Settings danger-zone convention), not decorative slop, and there are only 4 in the entire tree. This is an isolated architecture-vs-documentation drift, not a repeated implementation-shortcut pattern.

## Design Specificity Verdict

**Authored specifically for an Indonesian oil-change shop, with a few generic-scaffold seams.** Evidence for: bespoke `gardan`/engine/transmission vehicle modeling, Indonesian-magnitude currency formatting (`Rp 2,4 M`/`jt`/`rb`), real Indonesian license-plate format validation, a km-based (not date-based) service-due system with source provenance (`workshop_default` vs `customer_request`), and natural (not machine-translated) Indonesian UI strings.

Evidence against: the payment-method set (`cash | card | check | pending`) has no QRIS/e-wallet option — the dominant non-cash rail at Indonesian retail counters — while including "check," which is essentially unused there; this reads as a carried-over Western demo-app default, translated but not redesigned. Business-logic error strings (`orderOps.ts`) bypass i18n entirely and surface raw English mid-transaction even in Indonesian-locale mode. `CustomerActivityHeatmap.tsx` hardcodes `'en-US'` date formatting regardless of language. One vehicle-form placeholder pair still reads "Toyota"/"Camry" against DESIGN.md's own more authentic seed set (Avanza, Brio, Elf, L300, Xenia).

Deterministic scan: 4 findings, all `side-tab` border-accent warnings, all verified false positives in context (see Integrity verdict above) — no design-slop pattern detected at the CSS/markup level.

No browser visualization was performed — no browser-automation tool is available in this environment, and this is an Electron desktop target with no meaningful screenshot URL. Both assessments ran as static source review; this is the documented fallback, not a gap in effort.

## Overall Impression

The parts of this app that required real domain knowledge — service scheduling, currency formatting, plate validation, the receipt's proactive due-line reminder — are genuinely well built, better than a typical AI-generated shop-management demo. The parts that are "just infrastructure" — the data layer, the payment-method enum, a few error strings — are where the product's actual seams show. The single biggest risk isn't visual; it's that the documented database layer doesn't exist, and the app is quietly running a growing business's entire transaction history on `localStorage`.

## What's Working

- **Service-schedule/due-line system**: `ManageScheduleDialog.tsx` + `vehicleDueSummary.ts` + `Receipt.tsx`'s due-line printing form a coherent, km-based retention mechanic — not decoration, the product's actual core loop.
- **Token system discipline**: single amber accent, no gradients, `:focus-visible`-only focus rings, and this session's Tailwind opacity-modifier fix verified complete and consistent app-wide.
- **Financial/relational guardrails**: stock is re-validated at order-completion time (not just add-item time), and deletes are blocked for referenced entities with an explanatory toast rather than silently corrupting data.

## Priority Issues

**[P0] Documented database layer doesn't exist at runtime**
- Location: `prisma/schema.prisma` (unused), `src/lib/storageAdapter.ts`, `src/lib/persistence.ts`, `electron/main.ts`
- Category: Implementation Integrity
- Impact: The entire business's data (customers, vehicles, work orders, inventory, expenses — 16 stores) runs on `localStorage` with a ~5-10MB ceiling and no capacity warning, while CLAUDE.md and package.json both claim SQLite via Prisma. This is a real data-loss/growth-failure risk for a shop meant to accumulate years of history, not a documentation nitpick.
- Recommendation: Either wire Prisma + SQLite through an Electron IPC bridge for real, or remove the unused `prisma/` schema and dependencies and update CLAUDE.md to document `localStorage` as the deliberate architecture (with an explicit capacity-monitoring/export-reminder plan) — but stop shipping a doc that describes infrastructure that isn't there.
- Suggested command: `$impeccable harden`

**[P1] `--fg-3` fails WCAG AA contrast — converged finding from both assessments**
- Location: `src/index.css:21` (`--fg-3: #5f6d80`), used app-wide via `text-fg-3`/`text-text-secondary` for labels, hints, captions
- Category: Accessibility
- Impact: ~3.5:1 against `--bg-1`, ~3.7:1 against `--bg-0`, both below the 4.5:1 AA minimum for normal-size text (WCAG 2.1 SC 1.4.3). Baked into the design token itself, so it silently underlies form labels, hint text, and secondary row text across dozens of components — hard to read fast under uneven counter lighting, and an AA violation regardless.
- Recommendation: Lighten `--fg-3` toward ~`#7a8797` (computes to ~4.6:1 on `--bg-1`) or reserve it for 18px+ text only and introduce a separate AA-passing muted tone for body-size secondary text.
- Suggested command: `$impeccable audit` fix, or fold into `$impeccable polish`

**[P1] Payment-method set has no Indonesian mobile-payment option**
- Location: `src/store/workOrderStore.ts:45`, `WorkOrderEditor.tsx` payment dialog, `Receipt.tsx`
- Category: Design specificity / Match to real world
- Impact: `cash | card | check | pending` omits QRIS/e-wallet (GoPay/OVO/DANA), the dominant non-cash payment rail at Indonesian retail counters, while including a near-unused "check." At the exact moment a customer wants to pay, staff have no correct option to select.
- Recommendation: Add `qris`/`transfer` (or a generalized e-wallet option); demote "check" to legacy/optional.
- Suggested command: `$impeccable clarify`

**[P2] Business-logic error strings bypass i18n**
- Location: `src/lib/ops/orderOps.ts` (e.g. `'Not enough stock of ${productName}...'`, `'Order not found.'`), surfaced via `showToast` in `WorkOrderEditor.tsx`
- Category: Match to real world / Error recovery
- Impact: In Indonesian-locale mode, the one moment an operator is blocked from completing a sale shows raw English — worst possible moment for a language switch.
- Recommendation: Return error codes from the ops layer, translate at the call site with `t()`, matching the pattern used everywhere else.
- Suggested command: `$impeccable clarify`

**[P2] Flagship work-order flow doesn't consistently use its own design system**
- Location: `NewWorkOrderDialog.tsx`, `WorkOrderEditor.tsx` (hand-rolled `<select>`/`<input>` with copy-pasted classes instead of `Input`/`Select`), `Reports.tsx` (hand-rolled tab pills instead of `Tabs`)
- Category: Consistency and Standards
- Impact: This is DESIGN.md's own "flagship screen set," and it's the surface least consistently using the shared components — future styling changes (focus/error/disabled states) will silently miss these call sites.
- Recommendation: Swap hand-rolled fields for `Input`/`Select`/`Tabs`.
- Suggested command: `$impeccable layout`

**[P2] No positive feedback on order creation or completion**
- Location: `NewWorkOrderDialog.tsx`'s `handleCreate()` (no success toast, despite DESIGN.md §5.5 specifying one), `WorkOrderEditor.tsx`'s `handleComplete()` (print popup only, no confirmation)
- Category: Visibility of System Status / Emotional journey
- Impact: The lowest-stakes moment (opening a blank form) and the highest-stakes moment (taking payment) both get zero positive reinforcement — a real peak-end violation on a task repeated 40+ times a shift.
- Recommendation: Add the DESIGN.md-specified creation toast; add a completion toast ("Order SB-2043 completed — Rp 480,000 received") alongside the print dialog.
- Suggested command: `$impeccable delight`

**[P2] Owner/vehicle lookup in New Order is an unsearchable native select**
- Location: `NewWorkOrderDialog.tsx`
- Category: Flexibility and Efficiency
- Impact: `GlobalSearch.tsx` already implements fast fuzzy plate/VIN/order lookup elsewhere in the same codebase, but the highest-stakes flow forces staff to scroll a plain alphabetical dropdown instead of typing a plate number — the single biggest velocity loss for both power users and front-counter staff mid-transaction.
- Recommendation: Reuse the `GlobalSearch` pattern (typeahead by plate/name) as the primary entry point into New Order.
- Suggested command: `$impeccable shape`

**[P3] No list virtualization**
- Location: `WorkOrderList.tsx`, `Vehicles.tsx`, `Companies.tsx` — all render full arrays via `.map()`
- Category: Performance
- Impact: Not yet acute, but compounds with the `localStorage` ceiling as a multi-year shop history grows toward thousands of rows.
- Suggested command: `$impeccable optimize`

**[P3] Broad Zustand subscriptions**
- Location: `Vehicles.tsx`, `Companies.tsx`, `Customers.tsx` subscribe to entire stores with no selector
- Category: Performance
- Suggested command: `$impeccable optimize`

**[P3] Two false-affordance interactions**
- Location: `rowInteraction.ts`'s double-click-to-edit (zero visual hint) and `BayStatusBoard.tsx`'s dashboard tiles (`cursor-pointer` + hover, no `onClick` at all)
- Category: Recognition Rather Than Recall
- Suggested command: `$impeccable clarify`

**[P3] `prefers-reduced-motion` only covers the hero-reveal**
- Location: recharts entrance animations across `src/components/dashboard/*` and `src/components/reports/*` don't check the media query (only `ServiceHistoryTimelineChart.tsx` sets `isAnimationActive` deliberately)
- Category: Accessibility
- Suggested command: `$impeccable animate`

## Persona Red Flags

**Alex (Power User — technician doing 40+ orders/shift)**: Ctrl+N and Ctrl+3 both just navigate to `/work-orders` — neither opens the New Order dialog directly. The owner-lookup select can't be typed into, forcing a scroll through a name-sorted list instead of typing a known plate number. No Enter-to-submit shortcut on the add-line-item row.

**Sam (Accessibility-dependent)**: `Dialog.tsx` does real work here (`role="dialog"`, `aria-modal`, focus trap, Escape-to-close). But hand-rolled fields in `NewWorkOrderDialog`/`WorkOrderEditor` use plain `:focus` with a custom box-shadow instead of the shared `.focus-ring` (`:focus-visible`) utility — inconsistent focus-indicator style on the same screen. The `--fg-3` contrast failure hits this persona hardest. `BayStatusBoard.tsx`'s fake-interactive tiles are invisible to a screen reader in both directions (not focusable, but styled as clickable).

**Wati (project-specific — front-counter staff serving a watching walk-in customer)**: Can't search by plate in the New Order dialog, only by owner name — has to guess or scroll if she only recognizes the vehicle. If stock runs out mid-order in Indonesian-locale mode, the toast reason text appears in raw English mid-sentence. If the customer wants to pay QRIS, there's no correct button. After payment, nothing on-screen confirms "Rp 480,000 received" if the customer asks — she has to narrate it herself.

## Minor Observations

- Two parallel Tailwind color vocabularies coexist (`bg-3`/`fg-1` vs. `surface-sunken`/`text-secondary`) — both work today since both are repointed in `index.css`, but a future contrast fix touching only one vocabulary would silently miss the other's call sites (roughly half the codebase).
- `GlobalSearch.tsx` renders work-order results as `RO #2043` while every other surface (rows, editor header, receipts) uses the canonical `SB-2043` mono format — an ID-format inconsistency for the same entity.
- `Dialog.tsx`'s `size` prop (sm/md/lg/xl) diverges from DESIGN.md's literal pixel-width spec — a reasonable adaptation, but the spec was never updated to match.
- `BayCapacityGauge.tsx`'s `severityRamp` traffic-light option exists but nothing in `Dashboard.tsx` opts in, so shop-floor capacity going critical has no visual escalation on the gauge itself.
- Sidebar's collapsed-state icon tooltip uses the native `title` attribute rather than the app's own styled tooltip pattern.

## Questions to Consider

- If `GlobalSearch`'s fuzzy plate/VIN lookup already works well, why does the highest-stakes flow in the app (New Order) still force a plain alphabetical dropdown instead of reusing it?
- Is "payment complete" really meant to feel like a browser print popup — and if the popup gets blocked, does the operator's only confirmation that money changed hands disappear with it?
- Given how much real domain knowledge went into the schedule/gardan/odometer system, would 20 minutes with an actual shop owner about their real payment mix (cash/QRIS/transfer/card) surface other "we assumed X" gaps in the less-attended parts of the app?
