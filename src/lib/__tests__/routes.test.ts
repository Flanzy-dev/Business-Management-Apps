// Invariants that were impossible to express before ROUTES existed as one
// table — each used to require cross-checking five files by eye.
import { describe, it, expect } from 'vitest'
import { ROUTES, ROUTE_ALIASES, resolveAlias, findRoute } from '../routes'

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
})

describe('ROUTE_ALIASES', () => {
  it('every alias target exists in ROUTES', () => {
    for (const [alias, target] of Object.entries(ROUTE_ALIASES)) {
      expect(ROUTES.some((r) => r.path === target), `${alias} -> ${target}, but ${target} is not in ROUTES`).toBe(true)
    }
  })

  it('no alias is itself the target of another alias', () => {
    const aliasPaths = new Set(Object.keys(ROUTE_ALIASES))
    for (const target of Object.values(ROUTE_ALIASES)) {
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
  it('resolves an alias to its target path', () => {
    expect(resolveAlias('/workers')).toBe('/technicians')
  })

  it('leaves a non-alias path unchanged', () => {
    expect(resolveAlias('/technicians')).toBe('/technicians')
  })

  it('findRoute follows an alias to the target route definition', () => {
    expect(findRoute('/workers')).toBe(findRoute('/technicians'))
    expect(findRoute('/workers')?.titleKey).toBe('topbar.technicians')
  })

  it('findRoute returns undefined for an unregistered path', () => {
    expect(findRoute('/some-future-page')).toBeUndefined()
  })
})
