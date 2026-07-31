# Plan 01 — Finish, Test, and Commit the P&L Reports Work

## Goal

The working tree contains a nearly complete Profit & Loss report feature that is not committed:
modified `src/lib/currency.ts`, `src/lib/dates.ts`, `src/pages/Reports.tsx`; untracked
`src/lib/finance.ts` and `src/components/reports/` (4 components). Finish it by:

1. Migrating the Sales and Workers tabs in `Reports.tsx` off their duplicated inline date math
   onto the shared `getPeriodRange` helper (only the P&L tab uses it today — a half-done migration).
2. Adding vitest and unit tests for `src/lib/finance.ts` and the new `src/lib/dates.ts` helpers
   (there is currently NO test runner in this repo at all).
3. Verifying the build and committing everything.

## Exact files to touch

| File | Action |
|---|---|
| `package.json` | Add `vitest` devDependency and `"test": "vitest run"` script |
| `vitest.config.ts` | NEW — minimal config (or add a `test` block to `vite.config.ts` if one exists; check first) |
| `src/pages/Reports.tsx` | Remove inline date helpers (lines ~27–47), use shared helpers |
| `src/lib/__tests__/finance.test.ts` | NEW — unit tests |
| `src/lib/__tests__/dates.test.ts` | NEW — unit tests |

Do NOT edit `src/lib/finance.ts`, `src/lib/currency.ts`, `src/lib/dates.ts`, or anything in
`src/components/reports/` — they are complete. You are testing and consuming them, not changing them.

## Step-by-step implementation order

1. **Install vitest**: `npm install -D vitest`. Add to `package.json` scripts: `"test": "vitest run"`.
   Create `vitest.config.ts`:
   ```ts
   import { defineConfig } from 'vitest/config'
   export default defineConfig({
     test: { environment: 'node', include: ['src/**/*.test.ts'] },
   })
   ```
   The code under test is pure TypeScript (no DOM, no React), so `node` environment is correct —
   do not install jsdom.

2. **Migrate `Reports.tsx`**. Current code (lines ~27–47):
   ```ts
   const now = new Date()
   const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
   const startOfWeek = new Date(startOfDay)
   startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())
   const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
   const startOfYear = new Date(now.getFullYear(), 0, 1)
   const getStartDate = () => { switch (period) { ... } }
   const startDate = getStartDate()
   const periodOrders = completedOrders.filter(wo =>
     new Date(wo.completedAt || wo.createdAt) >= startDate
   )
   ```
   Replace all of it with:
   ```ts
   const periodOrders = useMemo(
     () => filterCompletedOrders(workOrders, getPeriodRange(period)),
     [workOrders, period]
   )
   ```
   importing `getPeriodRange` from `../lib/dates` and `filterCompletedOrders` from `../lib/finance`.
   Note `filterCompletedOrders` also filters `status === 'completed'`, so it takes ALL `workOrders`,
   not the pre-filtered `completedOrders`. Line 25 (`const completedOrders = workOrders.filter(...)`)
   may still be used by other tabs (all-time metrics) — search the file for other uses of
   `completedOrders` before deleting it; keep it if used.

3. **Write `src/lib/__tests__/finance.test.ts`** covering at minimum:
   - `computePnlSummary`: empty arrays → all zeros and `netMarginPct === null`; revenue 0 with
     expenses > 0 → `netMarginPct === null` (not `-Infinity`).
   - `pctDelta`: `pctDelta(x, 0) === null`; positive growth; negative previous uses `|previous|`
     as denominator (e.g. `pctDelta(50, -100)` → 150).
   - `computeMonthlyTrend`: returns exactly 12 points oldest→newest; an order 13 months old is
     excluded; pass an explicit `now` argument so the test is deterministic.
   - `computeCogs`: an item whose `productId` is not in the cost map contributes to
     `unknownProductRevenue`, NOT to `cogs`; items with `productId: null` count as service revenue.
   - `computePaymentSplit`: orders with `paymentMethod: 'pending'` get their own bucket; shares sum to ~100.
   - `expenseDate`: `expenseDate({date: '2026-03-05', ...})` returns local midnight —
     assert `.getHours() === 0 && .getDate() === 5` (this is the timezone-safety contract).

4. **Write `src/lib/__tests__/dates.test.ts`** covering:
   - `getPeriodRange('week', now)`: `range.start.getDay() === 0` (SUNDAY start) and
     `range.end` equals `now` (half-open `[start, now)`).
   - `getPeriodRange('day'/'month'/'year')` starts at the correct local boundary.
   - `getPreviousPeriodRange('month', now)`: covers the FULL previous month —
     `prev.end` equals current period's start.
   - `lastNMonthKeys(3, new Date(2026, 0, 15))` → `['2025-11', '2025-12', '2026-01']`
     (year-boundary crossing, oldest first).
   - `monthKeyLocal` uses local time (construct a Date near local midnight, assert no month shift).
   Pass explicit `now` values to every helper that accepts one — never depend on the wall clock.

5. **Verify**: `npm test` (all green), then `npm run build`. Note the build script runs
   `tsc && vite build && electron-builder`; if electron-builder is slow/fails for packaging-only
   reasons, `npx tsc --noEmit && npx vite build` is sufficient verification.

6. **Commit** everything: the 3 previously modified files, `src/lib/finance.ts`,
   `src/components/reports/` (4 files), the two test files, `vitest.config.ts`,
   `package.json` + lockfile. One commit, message like
   `Add P&L report with tested finance layer; unify report date-range logic`.

## Edge cases you must not get wrong

- **Behavior equivalence, not "correctness" fixes**: the old inline logic is *period-to-date*
  (`>= start`, no end bound). `getPeriodRange` is `[start, now)` — same results for real data
  since nothing is future-dated. Do NOT change this into full-calendar-period semantics; the
  P&L tab and the Sales/Workers tabs must agree.
- **Order date field**: `completedAt || createdAt` (that's what `orderDate()` in finance.ts does).
  Do not switch to `createdAt` alone.
- **Week starts Sunday** in both old and new code (`startOfWeek.getDate() - getDay()`). Do not use
  Monday/ISO week helpers.
- **`expenseDate` timezone contract**: expense dates are `'YYYY-MM-DD'` strings; `new Date('2026-03-05')`
  parses as UTC and shifts a day backward in UTC+7 (Jakarta). `expenseDate` parses components and
  builds a LOCAL date on purpose. Tests must assert local-midnight, and no new code may call
  `new Date(expense.date)` directly.
- **`formatCompactIDR` abbreviations are Indonesian**: `rb` = ribu (thousand), `jt` = juta (million),
  `M` = miliar (BILLION). `M` is NOT "million" — do not "fix" it.
- **Money is integer whole Rupiah** everywhere. Percentages/margins may be floats; amounts may not.
- **COGS uses current cost prices** (a documented simplification — it estimates cost of goods at
  today's `costPrice`, not historical). Do not attempt historical costing.
- **Half-open ranges**: `filterCompletedOrders`/`filterExpensesInRange` treat `DateRange` as
  start-inclusive, end-exclusive. Test fixtures placed exactly on `range.end` must be excluded.

## Acceptance criteria (verify each)

- [ ] `npm test` exits 0 with at least 12 passing assertions across the two test files.
- [ ] `npx tsc --noEmit` and `npx vite build` succeed.
- [ ] `startOfDay`, `startOfWeek`, `startOfMonth`, `startOfYear`, and `getStartDate` no longer
      appear anywhere in `src/pages/Reports.tsx` (grep to confirm).
- [ ] Run the app (`npm run dev` + `npm run electron:dev` or vite in browser): with some seeded
      work orders, the Sales tab totals for "month" match what they showed before the migration,
      and the P&L tab renders KPIs, trend chart, category bars, and payment split without errors.
- [ ] `git status` is clean after the commit; the commit includes the test infrastructure.
