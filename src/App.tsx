import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import type { ComponentType } from 'react'
import { runCostingBackfill } from './lib/ops/costingBackfill'
import { runStockLedgerBackfill } from './lib/ops/stockLedgerBackfill'
import { repairOrphanedScheduleRules } from './lib/ops/scheduleRuleOrphanRepair'
import { startSync } from './lib/sync/engine'
import { useAuthStore } from './store/authStore'
import { ROUTES, ROUTE_ALIASES, findRoute } from './lib/routes'
import LockScreen from './components/auth/LockScreen'
import RequireAdmin from './components/auth/RequireAdmin'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import WorkOrders from './pages/WorkOrders'
import Customers from './pages/Customers'
import Companies from './pages/Companies'
import Vehicles from './pages/Vehicles'
import Reminders from './pages/Reminders'
import Technicians from './pages/Technicians'
import Inventory from './pages/Inventory'
import Suppliers from './pages/Suppliers'
import Expenses from './pages/Expenses'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import Appointments from './pages/Appointments'
import Bays from './pages/Bays'
import ServiceHistory from './pages/ServiceHistory'
import Messages from './pages/Messages'
import Profile from './pages/Profile'

// path -> page element, keyed the same way src/components/Layout.tsx keys
// its icons — src/lib/routes.ts stays import-free, so the heavy page/icon
// imports live only where they're actually rendered.
const PAGES: Record<string, ComponentType> = {
  '/': Dashboard,
  '/appointments': Appointments,
  '/work-orders': WorkOrders,
  '/bays': Bays,
  '/vehicles': Vehicles,
  '/service-history': ServiceHistory,
  '/reminders': Reminders,
  '/customers': Customers,
  '/companies': Companies,
  '/technicians': Technicians,
  '/inventory': Inventory,
  '/suppliers': Suppliers,
  '/expenses': Expenses,
  '/reports': Reports,
  '/messages': Messages,
  '/settings': Settings,
  '/profile': Profile,
}

/** `/` is react-router's `index` route, not a `path` segment; every other
 *  route's `path` is relative to the parent `<Route path="/">` below.
 *  `pageOf` is the alias's own path for a plain route, or its target for an
 *  alias — kept separate from `path` so an alias renders the same page
 *  element under its own URL. */
function routeFor(path: string, pageOf: string = path) {
  const Page = PAGES[pageOf]
  return path === '/' ? <Route key={path} index element={<Page />} /> : <Route key={path} path={path.slice(1)} element={<Page />} />
}

function App() {
  const mode = useAuthStore((s) => s.mode)

  // Three one-time migrations for shops whose data predates them, each a
  // no-op on every launch after the first: give existing sales a frozen
  // cost, give the stock ledger a starting point matching what the old
  // stored qtyOnHand/qtyRemaining counters said (see
  // src/lib/ops/stockLedgerBackfill.ts for why order doesn't actually matter
  // between the first two), then clean up any ScheduleRule left orphaned by
  // the service-item-type reseed bug (see
  // src/lib/ops/scheduleRuleOrphanRepair.ts) — this one has to run after
  // serviceItemTypeStore's own module-scope seeding, which it always is,
  // since that runs synchronously at import time before React even renders.
  //
  // Runs unconditionally, ABOVE the lock-screen early return below — a
  // device sitting at the lock screen still needs startSync() running so a
  // cold follower can pull down the shop's admin password (security-store)
  // and actually reach its first-run "create password" state correctly.
  useEffect(() => {
    runCostingBackfill()
    runStockLedgerBackfill()
    repairOrphanedScheduleRules()
    // Multi-device sync (src/lib/sync/engine.ts): safe to start unconditionally
    // — with no LAN server reachable (plain `npm run dev`, or WiFi down) this
    // just settles into 'offline' status and the app works exactly as before.
    startSync()
  }, [])

  // No mode chosen yet on this device (see src/store/authStore.ts) — block
  // on the lock screen instead of the route tree. This has to be a plain
  // early return rather than a route-level guard: it must render with no
  // sidebar/topbar (Layout draws both) and before any route element mounts
  // (a guard inside a restricted page would still paint that page for a
  // frame first).
  if (mode === null) {
    return <LockScreen />
  }

  const workerRoutes = ROUTES.filter((r) => r.workerAccessible)
  const adminRoutes = ROUTES.filter((r) => !r.workerAccessible)
  // Aliases (currently just /workers -> /technicians) inherit their
  // permission from the route they resolve to, rather than restating it.
  const workerAliases = Object.keys(ROUTE_ALIASES).filter((alias) => findRoute(alias)?.workerAccessible)
  const adminAliases = Object.keys(ROUTE_ALIASES).filter((alias) => !findRoute(alias)?.workerAccessible)

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        {workerRoutes.map((r) => routeFor(r.path))}
        {workerAliases.map((alias) => routeFor(alias, ROUTE_ALIASES[alias]))}

        {/* Admin-only — see src/lib/routes.ts's workerAccessible flag for the
            allow-list this is the complement of. */}
        <Route element={<RequireAdmin />}>
          {adminRoutes.map((r) => routeFor(r.path))}
          {adminAliases.map((alias) => routeFor(alias, ROUTE_ALIASES[alias]))}
        </Route>
      </Route>
    </Routes>
  )
}

export default App
