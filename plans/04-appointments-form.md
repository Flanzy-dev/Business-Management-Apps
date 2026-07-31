# Plan 04 — Appointments: Real Creation Form + Date Filtering

## Goal

`src/pages/Appointments.tsx` renders real store data but its "New Appointment" modal is a stub
("Appointment creation form coming soon.", line ~198), and the date navigation + Day/Week toggle
are cosmetic — the lists ignore `selectedDate` and `viewMode` entirely. The store
(`src/store/appointmentStore.ts`) already has the full API: `addAppointment`, `updateAppointment`,
`deleteAppointment`, `setStatus`, `getAppointmentsForDate`, `getWalkIns`, `getScheduled`.

Deliver: a working create/edit appointment form (scheduled + walk-in), real day/week filtering
tied to the date navigator, and status/delete actions on appointments.

## Exact files to touch

| File | Action |
|---|---|
| `src/store/appointmentStore.ts` | One-line change: `export interface Appointment` (line 4 — currently not exported) |
| `src/pages/Appointments.tsx` | Replace stub modal with form; wire filtering; add edit/status/delete |
| `src/components/appointments/AppointmentForm.tsx` | NEW, optional — extract the form here if the page exceeds ~400 lines |

Follow the existing modal/form pattern from `src/pages/Customers.tsx` and the dialogs in
`src/pages/WorkOrders.tsx` (Dialog component from `src/components/ui/Dialog`, controlled inputs,
same input styling classes). Reuse `vehicleLabel` from `src/lib/entities.ts` and
`useToastStore` for feedback.

## Step-by-step implementation order

1. **Export the type**: change `interface Appointment {` to `export interface Appointment {` in
   `appointmentStore.ts`.

2. **Build the form** (create + edit in one component, `editingId: string | null` distinguishes):
   - **Owner**: the type has both `customerId: string | null` and `companyId: string | null`.
     Use an owner-type toggle (Customer / Company) + a select of that list (`useCustomerStore` /
     `useCompanyStore`). Choosing one must set the other to `null`.
   - **Vehicle**: select filtered to the chosen owner. FIRST check the actual owner field names on
     the Vehicle type in `src/store/vehicleStore.ts` (customerId/companyId or similar) and filter
     with those; also allow "No vehicle" (`vehicleId: null`).
   - **Walk-in checkbox** (`isWalkIn`): when checked, hide the date/time inputs and use the
     current time as `scheduledAt`, status stays `'scheduled'` (the walk-in queue is driven by
     `isWalkIn`, not status).
   - **Date + time inputs** (scheduled only): `<input type="date">` + `<input type="time">`,
     defaults = the page's `selectedDate` and next round hour.
   - **Duration**: number input, minutes, default 45, min 5.
   - **Service type**: text input (or a small select of common services + free text).
   - **Notes**: textarea, nullable.
   - Submit: `addAppointment({ vehicleId, customerId, companyId, scheduledAt, duration,
     serviceType, isWalkIn, status: 'scheduled', notes })` — the store adds id/createdAt/updatedAt.
     For edit, `updateAppointment(editingId, {...})`. Toast + close on success. Validate: an owner
     is required unless walk-in; date/time required unless walk-in.

3. **Wire the two entry points**: the header "New Appointment" button and empty-state link open
   the form blank; the "Add Walk-in" button (line ~183) opens it with `isWalkIn: true` preset.

4. **Real date filtering** for the Scheduled list (walk-in queue stays UNFILTERED — it means
   "waiting now"):
   ```ts
   const dayRange = (d: Date) => {
     const start = new Date(d.getFullYear(), d.getMonth(), d.getDate())
     const end = new Date(start); end.setDate(end.getDate() + 1)
     return { start, end }
   }
   const weekRange = (d: Date) => {
     const start = new Date(d.getFullYear(), d.getMonth(), d.getDate())
     start.setDate(start.getDate() - start.getDay())        // Sunday start
     const end = new Date(start); end.setDate(end.getDate() + 7)
     return { start, end }
   }
   const range = viewMode === 'day' ? dayRange(selectedDate) : weekRange(selectedDate)
   const scheduled = appointments.filter(a =>
     !a.isWalkIn &&
     !['completed', 'cancelled', 'no-show'].includes(a.status) &&
     new Date(a.scheduledAt) >= range.start && new Date(a.scheduledAt) < range.end)
   ```
   Sort the list by `scheduledAt` ascending. In week view, group or label rows by day.

5. **Week-aware navigation**: `navigateDate` steps ±7 days when `viewMode === 'week'` (±1 in day
   view). The date label shows the week range in week view (e.g. "Sun 5 Jul – Sat 11 Jul") instead
   of a single date; keep `formatDateLong(selectedDate)` for day view.

6. **Edit / status / delete**: clicking a scheduled row opens the form prefilled. Add a small
   actions area (row buttons or a dropdown like other pages' `DropdownMenu`): "Arrived"
   (`setStatus(id, 'arrived')`), "Cancel" (`'cancelled'`), "No-show" (`'no-show'`), "Delete"
   (confirm, then `deleteAppointment`). Walk-in rows get the same status actions.

## Edge cases you must not get wrong

- **Status exclusion mismatch**: the page currently excludes only `completed`/`cancelled`
  (lines 18–19) while the store's `getScheduled`/`getWalkIns` also exclude `no-show`. Use the
  store's set — all three are terminal — everywhere (lists AND header counts), or counts will
  disagree with the queue.
- **Timezone (UTC+7 Jakarta)**: build `scheduledAt` from the date and time inputs in LOCAL time:
  parse the parts and use `new Date(year, monthIndex, day, hh, mm).toISOString()`. Never do
  `new Date('2026-07-08' + 'T' + '09:00')`-style string concatenation or `new Date(dateOnlyString)`
  — date-only strings parse as UTC and shift a day.
- **Owner is customer XOR company**: switching owner type must null the other id AND reset the
  vehicle selection (the chosen vehicle may belong to the previous owner).
- **`getCustomerName` returns 'Walk-in' for `customerId === null`** — a company-owned appointment
  has null customerId and would wrongly display "Walk-in". Rewrite the display helper: check
  `companyId` (company name) first, then `customerId`, then fall back to 'Walk-in'.
- **Duration is a number of minutes**, not a time string. Coerce the input with `Number(...)` and
  guard `NaN`.
- **Empty-state copy** says "No scheduled appointments for this day" — parameterize: "this day" /
  "this week" per `viewMode`.
- **Editing prefill**: split the stored ISO `scheduledAt` back into local date and time input
  values (`getFullYear/getMonth/getDate/getHours/getMinutes` — NOT `toISOString().slice(...)`,
  which is UTC and shifts).
- **The header count line** (`{scheduled.length} scheduled, {walkIns.length} walk-ins waiting`)
  must be computed from the SAME filtered arrays the lists render.

## Acceptance criteria (verify each)

- [ ] Create a scheduled appointment for tomorrow 09:00: it does NOT appear in today's day view;
      clicking → (next day) shows it at "09:00"; this week's week view shows it (if tomorrow is in
      the same Sun–Sat week).
- [ ] Create a walk-in: it appears in the Walk-in Queue immediately and stays visible regardless of
      the selected date; date/time inputs were hidden in the form.
- [ ] Create a company-owned appointment: the list shows the company's name, not "Walk-in", and the
      vehicle select only offered that company's vehicles.
- [ ] Edit an appointment's time: reopening the form shows the same local time you saved (no ±7h
      shift); the list re-sorts.
- [ ] "Arrived" changes the badge; "Cancel"/"No-show" remove it from the active lists; Delete
      (after confirm) removes it permanently. All survive an app reload (localStorage
      `appointment-storage`).
- [ ] Header counts always equal the number of visible rows in each list.
- [ ] Week view: navigation arrows jump 7 days and the label shows a Sun–Sat range.
- [ ] `npx tsc --noEmit` and `npx vite build` pass.
