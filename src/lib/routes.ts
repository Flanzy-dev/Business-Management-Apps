// The single source of truth for what routes exist and what each one needs —
// derived by src/App.tsx (path -> element), src/lib/auth/permissions.ts
// (WORKER_ROUTES), src/components/Layout.tsx (sidebar nav + topbar titles)
// and src/hooks/useKeyboardShortcuts.ts (Ctrl+<key> -> path), so the five
// used to be hand-kept in sync separately. Zero imports on purpose — same
// discipline as src/lib/storageKeys.ts — so a Node-only test can read this
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
  { path: '/', labelKey: 'nav.dashboard', titleKey: 'topbar.dashboard', section: 1, workerAccessible: true, shortcut: 'd' },
  { path: '/appointments', labelKey: 'nav.appointments', titleKey: 'topbar.appointments', section: 1, workerAccessible: true },
  { path: '/work-orders', labelKey: 'nav.serviceOrders', titleKey: 'topbar.serviceOrders', section: 1, workerAccessible: true, shortcut: '3' },
  { path: '/bays', labelKey: 'nav.bays', titleKey: 'topbar.bays', section: 1, workerAccessible: true },
  { path: '/vehicles', labelKey: 'nav.vehicles', titleKey: 'topbar.vehicles', section: 1, workerAccessible: true, shortcut: '2' },
  { path: '/service-history', labelKey: 'nav.serviceHistory', titleKey: 'topbar.serviceHistory', section: 1, workerAccessible: true },
  { path: '/reminders', labelKey: 'nav.reminders', titleKey: 'topbar.reminders', section: 1, workerAccessible: true },

  { path: '/customers', labelKey: 'nav.customers', titleKey: 'topbar.customers', section: 2, workerAccessible: true, shortcut: '1' },
  { path: '/companies', labelKey: 'nav.companies', titleKey: 'topbar.companies', section: 2, workerAccessible: true },
  { path: '/technicians', labelKey: 'nav.technicians', titleKey: 'topbar.technicians', section: 2, workerAccessible: false },

  { path: '/inventory', labelKey: 'nav.inventory', titleKey: 'topbar.inventory', section: 3, workerAccessible: true, shortcut: '4' },
  { path: '/suppliers', labelKey: 'nav.suppliers', titleKey: 'topbar.suppliers', section: 3, workerAccessible: false },
  { path: '/expenses', labelKey: 'nav.expenses', titleKey: 'topbar.expenses', section: 3, workerAccessible: false },
  { path: '/reports', labelKey: 'nav.reports', titleKey: 'topbar.reports', section: 3, workerAccessible: false, shortcut: '5' },

  { path: '/messages', labelKey: 'nav.messages', titleKey: 'topbar.messages', section: 4, workerAccessible: true },

  // Not in the sidebar — reachable only via the profile dropdown footer.
  { path: '/settings', titleKey: 'topbar.settings', section: 5, workerAccessible: false },
  { path: '/profile', titleKey: 'topbar.profile', section: 5, workerAccessible: true },
]

/**
 * Back-compat path aliases: a URL that must resolve to the same page and
 * permission as another route, without being a second sidebar/topbar entry
 * of its own. `/workers` predates the `/technicians` rename.
 */
export const ROUTE_ALIASES: Readonly<Record<string, string>> = {
  '/workers': '/technicians',
}

export function resolveAlias(path: string): string {
  return ROUTE_ALIASES[path] ?? path
}

export function findRoute(path: string): RouteDef | undefined {
  return ROUTES.find((r) => r.path === resolveAlias(path))
}
