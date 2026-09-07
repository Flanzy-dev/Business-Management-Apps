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
| Auto-update | electron-updater against GitHub Releases (see "Releasing" below) |

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

## Releasing

Every packaged install checks GitHub Releases for a newer version, downloads it in the background,
and waits for someone to press "Restart & install" in Settings > Updates — see
[electron/main.ts](electron/main.ts)'s "Auto-update" section. That feed is easy to silently break,
so releasing follows a fixed sequence:

1. **Bump `version` in `package.json`.** It is the *only* place a version number is ever written
   by hand — the renderer reads it via Vite's `define` (`vite.config.ts` → `__APP_VERSION__` →
   [src/lib/appVersion.ts](src/lib/appVersion.ts)), Electron reads it via `app.getVersion()`, and
   electron-builder stamps it into the installer and `latest.yml`. A test
   ([src/lib/update/__tests__/versionSourceOfTruth.test.ts](src/lib/update/__tests__/versionSourceOfTruth.test.ts))
   fails `npm test` if a version number ever gets hand-copied into the UI strings again — it has
   drifted once already.
2. **Commit, then tag exactly `v<version>`** — e.g. `v1.1.4` for `package.json`'s `"1.1.4"`.
   `git tag v1.1.4 && git push --follow-tags`. electron-builder's GitHub `publish` provider looks
   up the release by this tag name, so a mismatch here means the upload goes to the wrong (or a
   new, empty) release.
3. **Build and publish in one command:**
   ```bash
   GH_TOKEN=<a token with repo scope> npm run release
   ```
   This runs the normal build (`electron:build` + `vite build`) and then
   `electron-builder --win nsis --publish always`, output redirected to a temp directory outside
   this repo's folder — **NSIS reliably fails when its output directory is inside a OneDrive-synced
   folder** (a fast write-then-read on the intermediate uninstaller stub races OneDrive's own
   sync/indexing); if this repo is ever moved outside OneDrive, that redirect in the `release`
   script can be simplified back to the default `release/` output dir.
   `--publish always` uploads the installer `.exe`, its `.blockmap`, **and `latest.yml`** as one
   operation, or fails loudly — this is deliberate. **Never publish a release by dragging the
   `.exe` onto the GitHub web UI instead**: the web uploader rewrites spaces in the filename to
   dots, which is exactly what broke every release before this feature existed (the on-disk
   installer, `latest.yml`'s reference to it, and the uploaded asset all had *different* names,
   so the updater's download would have 404'd). `npm run release`'s `--publish` path uploads via
   the API, which preserves the pinned, space-free `artifactName` (`package.json`'s `build`
   block) byte-for-byte.
4. **A release with no `latest.yml` is invisible to every installed app, silently** — nobody's
   update check errors, it just never finds anything new. If you ever do need to inspect a
   published release, confirm it has exactly three assets, all sharing one dash-separated name
   (`Surya-Baru-Setup-<version>.exe`, `.exe.blockmap`, and `latest.yml`) — three different names
   among them means the feed is broken again.
5. **Install the built `.exe` on at least one machine before or right after publishing.** Releases
   here go live immediately (no draft/staging step), so anything wrong with the build reaches every
   shop with auto-check on within about 6 hours.
6. **Never change `artifactName`** in `package.json`'s `build` block once a version has shipped —
   it is what keeps the on-disk installer, `latest.yml`'s reference to it, and the GitHub asset
   name in agreement.

**The very first version to contain this feature (v1.1.4) still has to be installed by hand on
every existing device** — v1.1.3 and earlier have no updater in them at all. Only v1.1.4 → v1.1.5
and later hops are automatic.

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
    same data, inventory above all, with offline devices reconciling on reconnect; Settings shows
    which devices are syncing with the shop and when each last actually did
12. **Auto-update** — the shop PC checks GitHub for a new version in the background and asks before
    installing (see "Releasing" above)

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
