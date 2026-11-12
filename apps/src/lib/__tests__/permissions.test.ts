// The route access matrix — proves Worker mode's allow-list matches the
// "shop-floor set" decision exactly, that admin always passes, and that the
// /workers alias and query-string/trailing-slash variants can't be used to
// slip past it. Does not cover password verification (password.test.ts) or
// how a mode is entered/persisted (authStore has no pure logic worth a
// separate test — it's a thin wrapper over these predicates and storage).
import { describe, it, expect } from 'vitest'
import { canAccessRoute, canManageSuppliers, canMutateInventory, canReceiveStock, canSeeCostAndProfit, canSeeSupplierCode, canVoidOrder, WORKER_ROUTES } from '../auth/permissions'

// /suppliers is not here: it now redirects to the worker-accessible Inventory
// page, where the Suppliers TAB is the admin-only part (canManageSuppliers).
const ADMIN_ONLY_ROUTES = ['/expenses', '/reports', '/technicians', '/workers', '/settings']

describe('canAccessRoute', () => {
  it('admin can reach every route, including ones nothing declares', () => {
    for (const path of [...WORKER_ROUTES, ...ADMIN_ONLY_ROUTES, '/some-future-page']) {
      expect(canAccessRoute('admin', path)).toBe(true)
    }
  })

  it('worker can reach exactly the shop-floor set', () => {
    for (const path of WORKER_ROUTES) {
      expect(canAccessRoute('worker', path)).toBe(true)
    }
  })

  it('worker is blocked from expenses, reports, technicians and settings', () => {
    for (const path of ADMIN_ONLY_ROUTES) {
      expect(canAccessRoute('worker', path)).toBe(false)
    }
  })

  it('an alias resolves to the same permission as the page it redirects to', () => {
    expect(canAccessRoute('worker', '/workers')).toBe(canAccessRoute('worker', '/settings'))
    expect(canAccessRoute('worker', '/workers')).toBe(false)
    expect(canAccessRoute('worker', '/companies')).toBe(true)
    expect(canAccessRoute('worker', '/expenses')).toBe(false)
  })

  it('the Suppliers tab stays admin-only even though its old path reaches Inventory', () => {
    expect(canAccessRoute('worker', '/suppliers')).toBe(true)
    expect(canManageSuppliers('worker')).toBe(false)
    expect(canManageSuppliers('admin')).toBe(true)
  })

  it('a query string or trailing slash cannot be used to slip past the guard', () => {
    expect(canAccessRoute('worker', '/reports?tab=pnl')).toBe(false)
    expect(canAccessRoute('worker', '/reports/')).toBe(false)
    expect(canAccessRoute('worker', '/inventory/')).toBe(true)
    expect(canAccessRoute('worker', '/inventory?tab=services')).toBe(true)
  })

  it('an unregistered route defaults to admin-only, not open', () => {
    expect(canAccessRoute('worker', '/some-future-page')).toBe(false)
  })

  it('the dashboard index route is always reachable', () => {
    expect(canAccessRoute('worker', '/')).toBe(true)
    expect(canAccessRoute('admin', '/')).toBe(true)
  })
})

describe('canSeeCostAndProfit / canMutateInventory / canSeeSupplierCode', () => {
  it('are true for admin and false for worker', () => {
    expect(canSeeCostAndProfit('admin')).toBe(true)
    expect(canSeeCostAndProfit('worker')).toBe(false)
    expect(canMutateInventory('admin')).toBe(true)
    expect(canMutateInventory('worker')).toBe(false)
    expect(canSeeSupplierCode('admin')).toBe(true)
    expect(canSeeSupplierCode('worker')).toBe(false)
  })
})

describe('canReceiveStock', () => {
  it('is true for both modes — recording an arrival is deliberately looser than canMutateInventory', () => {
    expect(canReceiveStock('admin')).toBe(true)
    expect(canReceiveStock('worker')).toBe(true)
  })

  it('does not widen canMutateInventory — a worker still can not add/edit/delete/adjust from Inventory', () => {
    expect(canMutateInventory('worker')).toBe(false)
  })
})

describe('canVoidOrder', () => {
  it('is admin-only — voiding a completed sale is a financial reversal', () => {
    expect(canVoidOrder('admin')).toBe(true)
    expect(canVoidOrder('worker')).toBe(false)
  })
})
