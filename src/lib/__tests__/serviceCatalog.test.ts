import { describe, it, expect } from 'vitest'
import type { ServiceCatalogItem } from '../../store/serviceCatalogStore'
import {
  serviceCatalogLine,
  resolveDefaultCatalogMatch,
  catalogIntervalKmFor,
  catalogDraftIntervals,
  initialCatalogDraft,
  catalogDraftToData,
  axisOnTagChange,
  NO_SCHEDULE_TAG,
} from '../serviceCatalog'

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

  it('copies the RAW stored name even for a built-in service with a translated label', () => {
    // serviceUsageCounts (serviceSuggestions.ts) keys its map by
    // item.description, and CheckoutServiceCards' "N on ticket" badge
    // filters i.description === service.name — both by equality against the
    // stored name. Writing entities.ts's translated label onto the line
    // instead would silently break both the moment the active language
    // differs from when the line was added. This is deliberate, not an
    // oversight — see serviceCatalogStore.ts's DEFAULT_SERVICES comment.
    const line = serviceCatalogLine(service({ name: 'Ganti Oli Mesin' }))
    expect(line.description).toBe('Ganti Oli Mesin') // NOT 'Engine Oil Change'
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

  it('refuses to guess when several candidates exist for the same tag', () => {
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

describe('catalogIntervalKmFor', () => {
  it("uses the catalog's real interval when it can resolve one", () => {
    const brakeFluid = service({ serviceItemTypeId: 'sit-brake', intervalKm: 40000 })
    expect(catalogIntervalKmFor([brakeFluid], 'sit-brake', 5000)).toBe(40000)
  })

  it('falls back to the shop default when the catalog is ambiguous', () => {
    const manual = service({ name: 'Manual', serviceItemTypeId: 'sit-trans', intervalKm: 15000 })
    const matic = service({ name: 'Matic', serviceItemTypeId: 'sit-trans', intervalKm: 25000 })
    expect(catalogIntervalKmFor([manual, matic], 'sit-trans', 5000)).toBe(5000)
  })

  it('falls back to the shop default when nothing is tagged at all', () => {
    expect(catalogIntervalKmFor([], 'sit-wash', 5000)).toBe(5000)
  })
})

describe('catalogDraftIntervals', () => {
  it('parses only the km field on the km axis', () => {
    expect(catalogDraftIntervals('km', '5000', '4')).toEqual({ intervalKm: 5000, intervalMonths: null })
  })

  it('parses only the months field on the months axis', () => {
    expect(catalogDraftIntervals('months', '5000', '4')).toEqual({ intervalKm: null, intervalMonths: 4 })
  })

  it('parses both fields on the both axis', () => {
    expect(catalogDraftIntervals('both', '5000', '4')).toEqual({ intervalKm: 5000, intervalMonths: 4 })
  })

  it('parses neither field on the none axis, even if both are typed', () => {
    expect(catalogDraftIntervals('none', '5000', '4')).toEqual({ intervalKm: null, intervalMonths: null })
  })

  it('treats a blank string as unset even on a live axis', () => {
    expect(catalogDraftIntervals('both', '', '')).toEqual({ intervalKm: null, intervalMonths: null })
  })
})

describe('initialCatalogDraft', () => {
  it('is blank with NO_SCHEDULE_TAG and price "0" for a new service', () => {
    const draft = initialCatalogDraft(null)
    expect(draft.name).toBe('')
    expect(draft.price).toBe('0')
    expect(draft.serviceItemTypeId).toBe(NO_SCHEDULE_TAG)
    expect(draft.intervalAxis).toBe('none')
  })

  it('mirrors an existing service\'s values, deriving the axis from its intervals', () => {
    const draft = initialCatalogDraft(service({ name: 'Ganti Oli', price: 75000, intervalKm: 5000, intervalMonths: 4 }))
    expect(draft.name).toBe('Ganti Oli')
    expect(draft.price).toBe('75000')
    expect(draft.intervalAxis).toBe('both')
    expect(draft.intervalKm).toBe('5000')
    expect(draft.intervalMonths).toBe('4')
  })
})

describe('catalogDraftToData', () => {
  it('trims the name and parses price/intervals through catalogDraftIntervals', () => {
    const draft = { ...initialCatalogDraft(null), name: '  Spooring  ', price: '75000', intervalAxis: 'km' as const, intervalKm: '10000' }
    const data = catalogDraftToData(draft)
    expect(data.name).toBe('Spooring')
    expect(data.price).toBe(75000)
    expect(data.intervalKm).toBe(10000)
    expect(data.intervalMonths).toBeNull()
  })

  it('maps NO_SCHEDULE_TAG to null', () => {
    const data = catalogDraftToData({ ...initialCatalogDraft(null), serviceItemTypeId: NO_SCHEDULE_TAG })
    expect(data.serviceItemTypeId).toBeNull()
  })
})

describe('axisOnTagChange', () => {
  it('flips "none" to "km" when a tag is picked', () => {
    expect(axisOnTagChange('oil-type', 'none')).toBe('km')
  })

  it('never overrides an axis already chosen — a deliberately time-only entry stays that way', () => {
    expect(axisOnTagChange('oil-type', 'months')).toBe('months')
    expect(axisOnTagChange('oil-type', 'both')).toBe('both')
    expect(axisOnTagChange('oil-type', 'km')).toBe('km')
  })

  it('clearing the tag (back to NO_SCHEDULE_TAG) does not itself change the axis', () => {
    expect(axisOnTagChange(NO_SCHEDULE_TAG, 'km')).toBe('km')
  })
})
