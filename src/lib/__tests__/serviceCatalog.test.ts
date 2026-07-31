import { describe, it, expect } from 'vitest'
import type { ServiceCatalogItem } from '../../store/serviceCatalogStore'
import { serviceCatalogLine, resolveDefaultCatalogMatch } from '../serviceCatalog'

let nextId = 1

function service(overrides: Partial<ServiceCatalogItem> = {}): ServiceCatalogItem {
  return {
    id: `svc-${nextId++}`,
    name: 'Jasa Ganti Oli',
    price: 50000,
    serviceItemTypeId: null,
    notes: '',
    createdAt: '2026-07-25T00:00:00.000Z',
    ...overrides,
  }
}

describe('serviceCatalogLine', () => {
  it('carries name and price onto a single-quantity line', () => {
    const line = serviceCatalogLine(service({ name: 'Spooring', price: 75000 }))
    expect(line.description).toBe('Spooring')
    expect(line.unitPrice).toBe(75000)
    expect(line.quantity).toBe(1)
  })

  it('never links a service to inventory (keeps it out of parts revenue)', () => {
    expect(serviceCatalogLine(service()).productId).toBeNull()
    expect(serviceCatalogLine(service({ serviceItemTypeId: 'sit-oil' })).productId).toBeNull()
  })

  it('tags a linked service as a "changed" service item', () => {
    const line = serviceCatalogLine(service({ serviceItemTypeId: 'sit-oil' }))
    expect(line.serviceItemTypeId).toBe('sit-oil')
    expect(line.serviceAction).toBe('changed')
    expect(line.quantityLiters).toBeNull()
    expect(line.containerType).toBeNull()
  })

  it('leaves an unlinked service completely untagged', () => {
    // Any schedule field leaking onto a plain labor line would make
    // buildServiceEventFromOrder record a service the shop never performed.
    const line = serviceCatalogLine(service({ serviceItemTypeId: null }))
    expect(line.serviceItemTypeId).toBeUndefined()
    expect(line.serviceAction).toBeUndefined()
    expect(line.quantityLiters).toBeUndefined()
    expect(line.containerType).toBeUndefined()
  })
})

describe('resolveDefaultCatalogMatch', () => {
  it('resolves the single candidate for a tag', () => {
    const oil = service({ serviceItemTypeId: 'sit-oil', intervalKm: 5000 })
    expect(resolveDefaultCatalogMatch([oil], 'sit-oil')).toBe(oil)
  })

  it('resolves the shop-picked default among several candidates', () => {
    const manual = service({ name: 'Manual', serviceItemTypeId: 'sit-trans', intervalKm: 15000 })
    const matic = service({ name: 'Matic', serviceItemTypeId: 'sit-trans', intervalKm: 25000, isDefaultForItemType: true })
    expect(resolveDefaultCatalogMatch([manual, matic], 'sit-trans')).toBe(matic)
  })

  it('refuses to guess when several candidates exist and none is marked default', () => {
    const manual = service({ name: 'Manual', serviceItemTypeId: 'sit-trans', intervalKm: 15000 })
    const matic = service({ name: 'Matic', serviceItemTypeId: 'sit-trans', intervalKm: 25000 })
    expect(resolveDefaultCatalogMatch([manual, matic], 'sit-trans')).toBeNull()
  })

  it('never matches a service with no interval at all, even if tagged', () => {
    const wash = service({ serviceItemTypeId: 'sit-wash' })
    expect(resolveDefaultCatalogMatch([wash], 'sit-wash')).toBeNull()
  })

  it('never matches an untagged service', () => {
    const tuneUp = service({ serviceItemTypeId: null, intervalKm: 20000 })
    expect(resolveDefaultCatalogMatch([tuneUp], 'sit-oil')).toBeNull()
  })

  it('returns null for a tag with no candidates at all', () => {
    expect(resolveDefaultCatalogMatch([], 'sit-oil')).toBeNull()
  })
})
