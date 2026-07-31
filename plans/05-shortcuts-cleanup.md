# Plan 05 — Keyboard Shortcuts Cleanup (Ctrl+K Conflict)

## Goal

Two independent `keydown` listeners both handle Ctrl+K:

1. `src/hooks/useKeyboardShortcuts.ts` (mounted globally via `Layout.tsx`), lines 29–38: focuses
   the first `input[placeholder*="Search"]` on the page, else navigates to `/customers`.
2. A separate `useEffect` inside `src/components/Layout.tsx` that opens the GlobalSearch overlay.

Both fire on every Ctrl+K press (focus-steal + overlay together), and the hook's version is
skipped entirely while typing in an input (its early-return guard) while Layout's is not —
inconsistent behavior. Make Layout's GlobalSearch the single owner of Ctrl+K, and make the
Settings page shortcut legend match the real bindings.

## Exact files to touch

| File | Action |
|---|---|
| `src/hooks/useKeyboardShortcuts.ts` | Delete the `case 'k'` block (lines 29–38) |
| `src/components/Layout.tsx` | Read its Ctrl+K `useEffect`; ensure `e.preventDefault()`; likely no change |
| `src/pages/Settings.tsx` | Update the shortcut legend copy |

## Step-by-step implementation order

1. In `useKeyboardShortcuts.ts`, delete the entire `case 'k': ... break` block, including the
   `const searchInput = ...` lookup. Leave everything else (guard, Ctrl+N/D/1–5) untouched.

2. In `Layout.tsx`, locate its own Ctrl+K `useEffect` (it opens GlobalSearch). Verify it:
   - matches on `(e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k'`,
   - calls `e.preventDefault()` (Ctrl+K is a browser/Electron accelerator in some contexts),
   - deliberately does NOT have the typing-in-input guard — opening global search while focused in
     an input is desired. Do not add the guard to it.
   If any of these are missing, fix them; otherwise leave the file unchanged.

3. In `Settings.tsx`, find the keyboard-shortcut legend section and make it list exactly the real
   bindings:
   - `Ctrl+K` — Global search
   - `Ctrl+N` — Work orders
   - `Ctrl+D` — Dashboard
   - `Ctrl+1` — Customers
   - `Ctrl+2` — Vehicles
   - `Ctrl+3` — Work orders
   - `Ctrl+4` — Inventory
   - `Ctrl+5` — Reports
   Match the existing markup/styling of the legend rows; only the data changes.

4. **Optional, only if trivial**: making Ctrl+N open the New Order dialog on the WorkOrders page.
   Check whether an existing mechanism exists (a query param the page reads, a Zustand ui flag, a
   route like `/work-orders?new=1` already handled). If yes, use it. If no such plumbing exists,
   SKIP this step entirely — do not invent new state or params for this plan.

## Edge cases you must not get wrong

- **The input guard is the reason two listeners exist.** The hook's early return (lines 10–15:
  target instanceof HTMLInputElement/TextArea/Select) suppresses ALL its shortcuts while typing.
  That's correct for Ctrl+1–5/N/D (digits and letters while typing must not navigate), and it's
  why Ctrl+K must live in Layout's guard-free listener. Do not consolidate the two listeners into
  one; do not add the guard to Layout's Ctrl+K.
- **Keep `e.key.toLowerCase()`** in both places — with Shift held, `e.key` is `'K'`.
- **Keep `metaKey` support** (`e.ctrlKey || e.metaKey`) — harmless on Windows, keeps Cmd working
  for anyone on macOS.
- **Each `useEffect` has its own add/removeEventListener teardown** — deleting the `case 'k'`
  block must not touch the hook's listener registration or cleanup, and Layout's effect stays
  intact.
- **Do not remove the hook's mount in `Layout.tsx`** (`useKeyboardShortcuts()`) — the other seven
  shortcuts still live there.

## Acceptance criteria (verify each)

- [ ] Ctrl+K opens the GlobalSearch overlay exactly once — and no page search input gets focus
      simultaneously (previously the hook would focus e.g. the Customers search box at the same
      time).
- [ ] Ctrl+K works while the cursor is inside a text input (e.g. focused in the Customers search
      field).
- [ ] With focus NOT in an input: Ctrl+1→Customers, Ctrl+2→Vehicles, Ctrl+3→Work orders,
      Ctrl+4→Inventory, Ctrl+5→Reports, Ctrl+N→Work orders, Ctrl+D→Dashboard.
- [ ] While typing in any input/textarea/select, Ctrl+1–5/N/D do nothing (no navigation).
- [ ] The Settings legend lists exactly the 8 bindings above, matching actual behavior.
- [ ] `npx tsc --noEmit` and `npx vite build` pass.
