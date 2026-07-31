# Plan 03 — Bay Management Actions

## Goal

`src/pages/Bays.tsx` renders a live bay status board but is read-only: the bay detail dialog
(lines 141–148) says "Bay management actions coming soon." and there is no way to add bays.
Meanwhile `src/store/bayStore.ts` ALREADY has the complete action API — `addBay`, `updateBay`,
`deleteBay`, `assignWorkOrder(bayId, workOrderId, workerId, estimatedMinutes)`, `clearBay(bayId)`,
`setStatus(bayId, status)` — none of it called from any UI. Wire it up:

- Assign an open work order (+ technician + estimated minutes) to an available bay.
- Change an occupied bay's status; clear a bay ("mark done").
- Add / rename / delete bays.
- Automatically clear a bay when its work order is completed (and on order deletion if a delete
  path exists).

No store changes are needed.

## Exact files to touch

| File | Action |
|---|---|
| `src/pages/Bays.tsx` | Replace stub dialog with action forms; add "Add bay" button; empty-state copy |
| `src/pages/WorkOrders.tsx` | In `handleComplete` (and the delete path if present), clear any bay holding that order |

Reuse existing components/helpers: `Dialog`, `Button` (already imported in Bays.tsx),
`vehicleLabelWithPlate` / `ownerName` from `src/lib/entities.ts`, `useToastStore` for feedback
(see how `WorkOrders.tsx` uses it).

## Step-by-step implementation order

1. **Change dialog state from object to id.** Currently `const [selectedBay, setSelectedBay] =
   useState<Bay | null>(null)` stores a snapshot — after any store action the dialog would show
   stale data. Replace with `const [selectedBayId, setSelectedBayId] = useState<string | null>(null)`
   and derive `const selectedBay = bays.find(b => b.id === selectedBayId) ?? null` on each render.
   Update the card `onClick` and the Dialog `open`/`onClose` accordingly.

2. **Available-bay dialog body** (when `selectedBay.status === 'available'`):
   - Select of assignable open work orders:
     ```ts
     const assignableOrders = workOrders.filter(wo =>
       wo.status === 'open' && !bays.some(b => b.currentWorkOrderId === wo.id))
     ```
     Option label: order number + vehicle (use `vehicleLabelWithPlate(vehicles.find(...))`) + owner.
   - Technician select from `workers` — when an order is chosen, default this to the order's
     `workerId` if set (still overridable).
   - Estimated minutes number input, default 45, min 5.
   - "Assign to bay" button → `assignWorkOrder(selectedBay.id, orderId, workerId || null, minutes)`,
     toast, close dialog. Disable the button until an order is selected.
   - Below a divider: **Rename** (text input prefilled with `bay.name` + save via
     `updateBay(id, { name })`) and **Delete bay** (allowed here because status is 'available';
     confirm first, then `deleteBay(id)` and close).

3. **Occupied-bay dialog body** (any non-available status):
   - Summary: work order number, vehicle, technician, time remaining (reuse the page's existing
     `getVehicleFromWorkOrder` / `getWorkerName` / `getTimeRemaining` helpers).
   - Status buttons for the three busy statuses — `'in-service' | 'inspection' | 'awaiting-parts'`
     via `setStatus`; highlight the current one.
   - "Mark done / Clear bay" button → `clearBay(id)`, toast, close.
   - Rename control as above. Delete button rendered but DISABLED with helper text
     "Clear the bay before deleting it."

4. **"Add bay" button** in the page header (next to the title, styled like other pages' primary
   buttons): opens a small dialog with a name input (default suggestion `Bay ${bays.length + 1}`) →
   ```ts
   addBay({ name, status: 'available', currentWorkOrderId: null,
            assignedWorkerId: null, estimatedEndTime: null })
   ```

5. **Auto-clear on completion.** In `src/pages/WorkOrders.tsx`, find `handleComplete` (it already
   calls `completeWorkOrder`, deducts stock via `adjustStock`, and prints the receipt). After
   completion add:
   ```ts
   const bay = useBayStore.getState().bays.find(b => b.currentWorkOrderId === order.id)
   if (bay) useBayStore.getState().clearBay(bay.id)
   ```
   (Using `getState()` inside the handler avoids adding a subscription; alternatively pull
   `bays`/`clearBay` from a `useBayStore` hook at component top — match the file's existing style.)
   If `WorkOrders.tsx` has a delete/cancel handler for orders, add the same clearing there.

6. **Empty-state copy.** Bays.tsx line ~75 says "Bay management will be added in a future update."
   Replace with a prompt to use the new Add bay button (and optionally render an Add bay button in
   the empty state itself).

## Edge cases you must not get wrong

- **Stale dialog snapshot** — this is why step 1 comes first. If you keep the `Bay` object in
  state, the dialog will show 'available' UI immediately after assigning, or stale names after
  rename.
- **Seed bay ids are `'1'`–`'4'`** (bayStore.ts lines 29–32), while `addBay` generates
  `crypto.randomUUID()`. Never parse or assume id format.
- **Dangling work-order references.** An order can be deleted while assigned; the board already
  tolerates this ("No vehicle assigned"). The occupied-bay dialog must still render and must still
  offer "Clear bay" when `workOrders.find(...)` returns undefined — clearing is exactly what the
  user needs then.
- **Don't compute `estimatedEndTime` in the UI.** `assignWorkOrder` computes it from
  `estimatedMinutes` internally. Pass minutes, nothing else.
- **Only the four status literals exist**: `'available' | 'in-service' | 'inspection' |
  'awaiting-parts'` (see `Bay` type + `STATUS_CONFIG`). 'available' is reached ONLY via
  `clearBay` — don't offer it as a manual status button (it would leave `currentWorkOrderId`
  populated on an "available" bay).
- **Double-assignment guard** works in both directions: the assignable-orders list excludes orders
  already on another bay, AND assignment is only offered on available bays, so a bay can't get a
  second order either.
- **`workerId` may be null** — `assignWorkOrder` accepts `workerId: string | null`; pass `null`,
  not `''` or `undefined`.
- **Completing an order that was never assigned to a bay** must be a no-op in step 5 (the `if (bay)`
  guard) — most orders won't be on a bay.

## Acceptance criteria (verify each)

- [ ] Create an open work order with a vehicle; click an available bay; the order appears in the
      select; assign with a technician and 30 minutes → the card shows in-service, vehicle,
      plate, technician name, and a countdown ("Xm left").
- [ ] That same order no longer appears in any other bay's assignment list.
- [ ] Complete the order from the Work Orders page → the bay returns to available automatically
      (no manual clearing).
- [ ] Status buttons cycle an occupied bay between in-service / inspection / awaiting-parts, with
      the board's top-border color updating.
- [ ] "Clear bay" frees an occupied bay even after its work order was deleted from Work Orders.
- [ ] Add bay, rename bay, and delete (only offered/enabled when available) all work and persist
      across an app reload (localStorage `bay-storage`).
- [ ] Empty state (delete all bays) shows the new copy and a way to add a bay.
- [ ] `npx tsc --noEmit` and `npx vite build` pass.
