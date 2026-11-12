import { describe, it, expect } from 'vitest'
import { resolveTab, keepOnlyTab, withTab } from '../app/navigation'

describe('resolveTab', () => {
  const tabs = ['products', 'services', 'suppliers'] as const

  it('returns the requested tab when it is allowed', () => {
    expect(resolveTab(new URLSearchParams('tab=services'), tabs, 'products')).toBe('services')
  })

  it('falls back when no tab is requested', () => {
    expect(resolveTab(new URLSearchParams(''), tabs, 'products')).toBe('products')
  })

  it('falls back for an unknown tab', () => {
    expect(resolveTab(new URLSearchParams('tab=nope'), tabs, 'products')).toBe('products')
  })

  it('falls back for a tab this mode may not see', () => {
    const workerTabs = ['products', 'services'] as const
    expect(resolveTab(new URLSearchParams('tab=suppliers'), workerTabs, 'products')).toBe('products')
  })
})

describe('keepOnlyTab', () => {
  it('drops one-shot request params but keeps the tab', () => {
    expect(keepOnlyTab(new URLSearchParams('tab=companies&new=1&fromOrder=1')).toString()).toBe('tab=companies')
  })

  it('is empty when there was no tab', () => {
    expect(keepOnlyTab(new URLSearchParams('new=1')).toString()).toBe('')
  })
})

describe('withTab', () => {
  it('sets only the tab', () => {
    expect(withTab('reminders').toString()).toBe('tab=reminders')
  })
})
