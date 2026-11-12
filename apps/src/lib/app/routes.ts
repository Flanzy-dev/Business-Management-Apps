// The single source of truth for what routes exist and what each one needs —
// derived by src/App.tsx (path -> element), src/lib/auth/permissions.ts
// (WORKER_ROUTES), src/components/layout/Layout.tsx (sidebar nav + topbar titles)
// and src/hooks/useKeyboardShortcuts.ts (Ctrl+<key> -> path), so the five
// used to be hand-kept in sync separately. Zero imports on purpose — same
// discipline as src/lib/storage/storageKeys.ts — so a Node-only test can read this
// without pulling in React, react-router or lucide-react.
//
// Icons and page components stay in Layout.tsx/App.tsx, keyed by path: they're
// the heavy imports this file exists to keep out.
export interface RouteDef {
  path: string
  /** Absent = not in the sidebar (reachable only via the profile dropdown
   *  footer: settings, profile). */
  labelKey?: string
  titleKey: string
  /** Sidebar grouping — a divider is drawn wherever this changes between two
   *  consecutive visible items, not stored as its own entry. */
  section: number
  workerAccessible: boolean
  /** Ctrl/Cmd + this key navigates here (src/hooks/useKeyboardShortcuts.ts). */
  shortcut?: string
}

export const ROUTES: readonly RouteDef[] = [
  // The counter's day: what's happening now, and the vehicles it's happening to.
  { path: '/', labelKey: 'nav.dashboard', titleKey: 'topbar.dashboard', section: 1, workerAccessible: true, shortcut: 'd' },
  { path: '/work-orders', labelKey: 'nav.serviceOrders', titleKey: 'topbar.serviceOrders', section: 1, workerAccessible: true, shortcut: '3' },
  { path: '/schedule', labelKey: 'nav.schedule', titleKey: 'topbar.schedule', section: 1, workerAccessible: true },
  { path: '/vehicles', labelKey: 'nav.vehicles', titleKey: 'topbar.vehicles', section: 1, workerAccessible: true, shortcut: '2' },

  // The shop's books: who it serves, what it stocks, how it's doing.
  { path: '/customers', labelKey: 'nav.customers', titleKey: 'topbar.customers', section: 2, workerAccessible: true, shortcut: '1' },
  { path: '/inventory', labelKey: 'nav.inventory', titleKey: 'topbar.inventory', section: 2, workerAccessible: true, shortcut: '4' },
  { path: '/reports', labelKey: 'nav.reports', titleKey: 'topbar.reports', section: 2, workerAccessible: false, shortcut: '5' },

  // Not in the sidebar — reachable only via the profile dropdown footer.
  { path: '/settings', titleKey: 'topbar.settings', section: 5, workerAccessible: false },
  { path: '/profile', titleKey: 'topbar.profile', section: 5, workerAccessible: true },
]

/**
 * Old paths that now redirect, so bookmarks and links keep working. A target
 * may carry a query naming the tab that took the old page over (see
 * src/lib/app/navigation.ts); the redirect keeps whatever query the old URL had,
 * e.g. `/companies?new=1` -> `/customers?tab=companies&new=1`. A redirect
 * lands under the TARGET route's permission — `/suppliers` reaches
 * /inventory, where the Suppliers tab itself is admin-only.
 *
 * `/workers` predates the `/technicians` rename; the rest are the pages
 * merged into tabs when the sidebar went from 14 items to 7.
 */
export const ROUTE_ALIASES: Readonly<Record<string, string>> = {
  '/workers': '/settings?tab=technicians',
  '/technicians': '/settings?tab=technicians',
  '/companies': '/customers?tab=companies',
  '/appointments': '/schedule?tab=appointments',
  '/reminders': '/schedule?tab=reminders',
  '/suppliers': '/inventory?tab=suppliers',
  '/expenses': '/reports?tab=expenses',
  // Its board is on the Dashboard; the page itself was read-only.
  '/bays': '/',
  // A vehicle's full history opens from its row on Vehicles.
  '/service-history': '/vehicles',
}

/** The route path an alias resolves to — its target without the query. */
export function resolveAlias(path: string): string {
  const target = ROUTE_ALIASES[path]
  return target ? target.split('?')[0] : path
}

/** Where a redirect from `aliasPath` should land, merging the target's own
 *  query (the tab) with the query the old URL arrived with. */
export function aliasRedirect(aliasPath: string, search: string): string {
  const [targetPath, targetQuery = ''] = (ROUTE_ALIASES[aliasPath] ?? aliasPath).split('?')
  const params = new URLSearchParams(targetQuery)
  new URLSearchParams(search).forEach((value, key) => {
    if (!params.has(key)) params.set(key, value)
  })
  const query = params.toString()
  return query ? `${targetPath}?${query}` : targetPath
}

export function findRoute(path: string): RouteDef | undefined {
  return ROUTES.find((r) => r.path === resolveAlias(path))
}
