import { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import type { ComponentType } from 'react'
import { runCostingBackfill } from './lib/ops/costingBackfill'
import { runStockLedgerBackfill } from './lib/ops/stockLedgerBackfill'
import { repairOrphanedScheduleRules } from './lib/ops/scheduleRuleOrphanRepair'
import { ensureSecurityComplete } from './lib/auth/securityCompleteness'
import { startSync } from './lib/sync/engine'
import { useDeviceStore } from './store/deviceStore'
import { subscribeUpdateState } from './lib/update/updateBridge'
import { startHostVersionWatch } from './lib/update/hostVersionWatch'
import { useUpdateStore } from './store/updateStore'
import { useLanguageStore } from './store/languageStore'
import { attachSessionResumeWatcher, useAuthStore } from './store/authStore'
import { ROUTES, ROUTE_ALIASES, findRoute, aliasRedirect } from './lib/app/routes'
import LoginScreen from './components/auth/LoginScreen'
import RequireAdmin from './components/auth/RequireAdmin'
import Layout from './components/layout/Layout'
import Dashboard from './pages/Dashboard'
import WorkOrders from './pages/WorkOrders'
import Vehicles from './pages/Vehicles'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import Profile from './pages/Profile'
import { CustomersPage, SchedulePage, InventoryPage } from './pages/tabbedPages'

// path -> page element, keyed the same way src/components/layout/Layout.tsx keys
// its icons — src/lib/app/routes.ts stays import-free, so the heavy page/icon
// imports live only where they're actually rendered.
const PAGES: Record<string, ComponentType> = {
  '/': Dashboard,
  '/work-orders': WorkOrders,
  '/schedule': SchedulePage,
  '/vehicles': Vehicles,
  '/customers': CustomersPage,
  '/inventory': InventoryPage,
  '/reports': Reports,
  '/settings': Settings,
  '/profile': Profile,
}

/** `/` is react-router's `index` route, not a `path` segment; every other
 *  route's `path` is relative to the parent `<Route path="/">` below. */
function routeFor(path: string) {
  const Page = PAGES[path]
  return path === '/' ? <Route key={path} index element={<Page />} /> : <Route key={path} path={path.slice(1)} element={<Page />} />
}

/** An old path (see ROUTE_ALIASES) redirects to the page and tab that took
 *  it over, keeping the query it arrived with. A redirect rather than
 *  mounting the target page under the old URL, so the address bar, the
 *  sidebar's active item and the tab row all agree. */
function AliasRedirect({ alias }: { alias: string }) {
  const { search } = useLocation()
  return <Navigate to={aliasRedirect(alias, search)} replace />
}

function aliasRouteFor(alias: string) {
  return <Route key={alias} path={alias.slice(1)} element={<AliasRedirect alias={alias} />} />
}

function App() {
  const mode = useAuthStore((s) => s.mode)

  // index.html ships lang="en"; keep the document's declared language in step
  // with the UI language so screen readers pick the right voice and the
  // browser's own widgets (date pickers, spellcheck) match. Above the login
  // early return so the sign-in screen is covered too.
  const language = useLanguageStore((s) => s.language)
  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

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
  // Runs unconditionally, ABOVE the login-screen early return below — a
  // device sitting at the login screen still needs startSync() running so a
  // cold follower can pull down the shop's accounts (security-store) and
  // reach the right screen: "sign in" rather than "set this shop up".
  useEffect(() => {
    runCostingBackfill()
    runStockLedgerBackfill()
    repairOrphanedScheduleRules()
    // Every account gets the credentials that go with it — admin and worker
    // LAN tokens, and the admin recovery code (shown only on a live admin
    // session). For shops whose accounts predate any of them; see
    // src/lib/auth/securityCompleteness.ts for why each one matters.
    ensureSecurityComplete({ isAdminSession: () => useAuthStore.getState().mode === 'admin' })
    // Adds this device's own row to the synced device registry
    // (src/store/deviceStore.ts) if it doesn't have one yet — backs the
    // device list in Settings > Multi-device sync. Idempotent, and safe to
    // run before sync has pulled anything down: it only ever checks and
    // writes THIS device's own id, never another device's.
    useDeviceStore.getState().registerSelf()
    // Multi-device sync (src/lib/sync/engine.ts): safe to start unconditionally
    // — with no LAN server reachable (plain `npm run dev`, or WiFi down) this
    // just settles into 'offline' status and the app works exactly as before.
    startSync()
    // Paired with the line above, and pointless without it: a follower boots
    // with an empty security-store, so a valid saved Admin session can't be
    // verified yet and is (correctly) refused. This resumes it the moment
    // sync delivers the shop's accounts, so "stay signed in" works on
    // followers and not just on the host. Self-disposing; no cleanup needed.
    attachSessionResumeWatcher()
  }, [])

  // Auto-update (electron/main.ts's "Auto-update" section): primes
  // useUpdateStore from whatever state already exists (main can start
  // checking well before this mounts) and subscribes to further pushes. A
  // separate effect from the block above, with its own cleanup, because
  // this one actually needs to unsubscribe — the block above's effects are
  // all fire-and-forget or self-disposing. Safe to run unconditionally: on
  // a browser tab (no window.electronAPI) or in plain `npm run dev`,
  // subscribeUpdateState's bridge() returns null and this becomes a no-op.
  useEffect(() => {
    return subscribeUpdateState(useUpdateStore.getState().setUpdate)
  }, [])

  // Version-skew warning for a follower running older/newer code than its
  // host — see src/lib/update/hostVersionWatch.ts. No-ops on a 'main'
  // device or a browser tab (see that file's header); safe to run always.
  useEffect(() => {
    return startHostVersionWatch()
  }, [])

  // Signed out (see src/store/authStore.ts) — block on the login screen
  // instead of the route tree. Covers a fresh install, a device that pressed
  // Switch account, and a follower still waiting on its first sync. This has
  // to be a plain early return rather than a route-level guard: it must
  // render with no sidebar/topbar (Layout draws both) and before any route
  // element mounts (a guard inside a restricted page would still paint that
  // page for a frame first).
  if (mode === null) {
    return <LoginScreen />
  }

  const workerRoutes = ROUTES.filter((r) => r.workerAccessible)
  const adminRoutes = ROUTES.filter((r) => !r.workerAccessible)
  // Aliases inherit their permission from the route they redirect to, rather
  // than restating it.
  const workerAliases = Object.keys(ROUTE_ALIASES).filter((alias) => findRoute(alias)?.workerAccessible)
  const adminAliases = Object.keys(ROUTE_ALIASES).filter((alias) => !findRoute(alias)?.workerAccessible)

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        {workerRoutes.map((r) => routeFor(r.path))}
        {workerAliases.map(aliasRouteFor)}

        {/* Admin-only — see src/lib/app/routes.ts's workerAccessible flag for the
            allow-list this is the complement of. */}
        <Route element={<RequireAdmin />}>
          {adminRoutes.map((r) => routeFor(r.path))}
          {adminAliases.map(aliasRouteFor)}
        </Route>
      </Route>
    </Routes>
  )
}

export default App
