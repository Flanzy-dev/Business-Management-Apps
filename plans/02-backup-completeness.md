# Plan 02 — Backup Completeness: Include Bays & Appointments

## Goal

The Settings page backup/restore (`src/pages/Settings.tsx`) covers only 9 of the 11 persisted
Zustand stores. The bays and appointments stores are silently omitted: a user who backs up,
clears data, and restores loses all bay configuration and every appointment. Add the two missing
stores to both backup and restore, and add a version/metadata field to the backup payload.

## Exact files to touch

- `src/pages/Settings.tsx` — ONLY file. No store changes, no new files.

## Step-by-step implementation order

1. In `handleBackup` (around lines 41–49) the payload currently reads these localStorage keys:
   `customer-store`, `company-store`, `vehicle-store`, `worker-store`, `work-order-store`,
   `inventory-store`, `supplier-store`, `expense-store`, `settings-store`. Add:
   ```ts
   bays: localStorage.getItem('bay-storage'),
   appointments: localStorage.getItem('appointment-storage'),
   _meta: JSON.stringify({ version: 2, exportedAt: new Date().toISOString() }),
   ```
   (Keep `_meta` a string like the other values so the payload stays homogeneous, or store it as
   an object — either is fine as long as restore ignores it.)

2. In `handleRestore` (around lines 77–85), after the existing per-key guards, add:
   ```ts
   if (data.bays) localStorage.setItem('bay-storage', data.bays)
   if (data.appointments) localStorage.setItem('appointment-storage', data.appointments)
   ```
   Keep every existing `if (data.X)` guard exactly as-is — restoring an old 9-key backup must
   work without error and must leave the CURRENT bays/appointments untouched (guards skip
   missing keys).

3. If the Settings page displays copy describing what the backup includes (a bullet list or
   description near the backup button), update it to mention bays and appointments.

## Edge cases you must not get wrong

- **The two key names use a different suffix.** Nine stores persist as `*-store`, but these two
  are `bay-storage` (`src/store/bayStore.ts:102`) and `appointment-storage`
  (`src/store/appointmentStore.ts:86`). Writing `bay-store` compiles and runs but silently
  backs up `null` — the `if` guard then skips it on restore and you've fixed nothing. Copy the
  key names from the store files, character for character.
- **Values are already JSON strings** (the zustand `persist` envelope `{"state":...,"version":0}`).
  Copy them verbatim with `getItem`/`setItem`. Do NOT `JSON.parse` them, re-wrap them, or merge
  them — that corrupts the persist envelope.
- **`_meta` must never be written to localStorage on restore.** The per-key `if (data.X)` pattern
  already guarantees this. Do not refactor restore into a loop over `Object.keys(data)` that
  writes every key blindly.
- **`localStorage.getItem` returns `null` for stores never touched** (e.g. user never opened
  Appointments). `JSON.stringify` turns that into `null` in the payload; the restore guard skips
  it. That is correct behavior — don't add empty-array fallbacks.
- **`handleClearData` uses `localStorage.clear()`** — it already wipes all 11 keys. Leave it alone.
- **Restore ends with `window.location.reload()`** — keep that; zustand persist only rehydrates
  on load.

## Acceptance criteria (verify each)

- [ ] Run the app, create at least one appointment and change one bay's state, export a backup.
      Open the downloaded JSON: it contains `bays`, `appointments`, and `_meta` alongside the
      original 9 keys, and `bays` contains the string `"bay-storage"`-style persist envelope
      (i.e. `{"state":{"bays":[...`).
- [ ] Use "Clear all data", then restore that backup: after reload, bays and appointments are back
      exactly as they were.
- [ ] Craft (or keep from before the change) a 9-key backup file and restore it: no error thrown,
      the other 9 stores restore, and whatever bays/appointments currently exist are unchanged.
- [ ] `npx tsc --noEmit` passes.
