// Invariants that were impossible to express before ROUTES existed as one
// table — each used to require cross-checking five files by eye.
import { describe, it, expect } from 'vitest'
import { ROUTES, ROUTE_ALIASES, resolveAlias, findRoute, aliasRedirect } from '../app/routes'

describe('ROUTES', () => {
  it('every route has a title key', () => {
    for (const r of ROUTES) {
      expect(r.titleKey, `${r.path} is missing a titleKey`).toBeTruthy()
    }
  })

  it('every shortcut is unique', () => {
    const shortcuts = ROUTES.filter((r) => r.shortcut).map((r) => r.shortcut)
    expect(new Set(shortcuts).size).toBe(shortcuts.length)
  })

  it('has no duplicate paths', () => {
    const paths = ROUTES.map((r) => r.path)
    expect(new Set(paths).size).toBe(paths.length)
  })

  // The simplification target: a short sidebar. Raising this should be a
  // deliberate decision, not a side effect of adding a page.
  it('keeps the sidebar to 7 items for an admin and 6 for a worker', () => {
    const inSidebar = ROUTES.filter((r) => r.labelKey)
    expect(inSidebar).toHaveLength(7)
    expect(inSidebar.filter((r) => r.workerAccessible)).toHaveLength(6)
  })
})

describe('ROUTE_ALIASES', () => {
  it('every alias target exists in ROUTES', () => {
    for (const alias of Object.keys(ROUTE_ALIASES)) {
      const target = resolveAlias(alias)
      expect(ROUTES.some((r) => r.path === target), `${alias} -> ${target}, but ${target} is not in ROUTES`).toBe(true)
    }
  })

  it('no alias is itself the target of another alias', () => {
    const aliasPaths = new Set(Object.keys(ROUTE_ALIASES))
    for (const alias of Object.keys(ROUTE_ALIASES)) {
      const target = resolveAlias(alias)
      expect(aliasPaths.has(target), `${target} is both an alias and an alias target`).toBe(false)
    }
  })

  it('no alias path collides with a real route path', () => {
    const routePaths = new Set(ROUTES.map((r) => r.path))
    for (const alias of Object.keys(ROUTE_ALIASES)) {
      expect(routePaths.has(alias), `${alias} is both a real route and an alias`).toBe(false)
    }
  })
})

describe('resolveAlias / findRoute', () => {
  it('resolves an alias to its target path, without the tab query', () => {
    expect(resolveAlias('/workers')).toBe('/settings')
    expect(resolveAlias('/companies')).toBe('/customers')
  })

  it('leaves a non-alias path unchanged', () => {
    expect(resolveAlias('/customers')).toBe('/customers')
  })

  it('findRoute follows an alias to the target route definition', () => {
    expect(findRoute('/suppliers')).toBe(findRoute('/inventory'))
    expect(findRoute('/expenses')?.titleKey).toBe('topbar.reports')
  })

  it('findRoute returns undefined for an unregistered path', () => {
    expect(findRoute('/some-future-page')).toBeUndefined()
  })
})

describe('aliasRedirect', () => {
  it('lands on the tab that took the old page over', () => {
    expect(aliasRedirect('/companies', '')).toBe('/customers?tab=companies')
  })

  it('keeps the query the old URL arrived with', () => {
    expect(aliasRedirect('/suppliers', '?new=1&fromExpense=1')).toBe('/inventory?tab=suppliers&new=1&fromExpense=1')
  })

  it('does not let the old query override the tab', () => {
    expect(aliasRedirect('/reminders', '?tab=appointments')).toBe('/schedule?tab=reminders')
  })

  it('redirects to a plain path when there is no query at all', () => {
    expect(aliasRedirect('/bays', '')).toBe('/')
  })
})
