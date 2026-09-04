import { describe, it, expect } from 'vitest'
import type { ServiceCatalogItem } from '../../store/serviceCatalogStore'
import type { ServiceEvent } from '../../store/serviceEventStore'
import type { ScheduleRule } from '../../store/scheduleRuleStore'
import type { WorkOrder, WorkOrderItem } from '../../store/workOrderStore'
import type { DueLine } from '../scheduleEngine'
import {
  lastChangeOdometerByItemType,
  overdueServiceSuggestions,
  rankServicesByUsage,
  serviceUsageCounts,
  suggestServices,
} from '../serviceSuggestions'

/** A km-only DueLine, as groupDueLines would produce for a rule with no month interval. */
function dueLine(dueKm: number, itemTypeIds: string[]): DueLine {
  return { dueKm, dueDate: null, itemTypeIds }
}

/** A months-only DueLine, as groupDueLines would produce for a rule with no km interval. */
function dateLine(dueDate: string, itemTypeIds: string[]): DueLine {
  return { dueKm: null, dueDate, itemTypeIds }
}

let nextId = 1

function service(overrides: Partial<ServiceCatalogItem> = {}): ServiceCatalogItem {
  return {
    id: `svc-${nextId++}`,
    name: 'Ganti Oli Mesin',
    price: 50000,
    serviceItemTypeId: 'sit-oil',
    notes: '',
    createdAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  }
}

function item(overrides: Partial<WorkOrderItem> = {}): WorkOrderItem {
  return {
    id: `item-${nextId++}`,
    description: 'Ganti Oli Mesin',
    quantity: 1,
    unitPrice: 50000,
    lineTotal: 50000,
    productId: null,
    ...overrides,
  }
}

function order(overrides: Partial<WorkOrder> = {}): WorkOrder {
  return {
    id: `wo-${nextId++}`,
    orderNumber: 1001,
    vehicleId: 'v-1',
    workerId: null,
    driverId: null,
    odometerAtArrival: null,
    odometerAtService: null,
    date: '2026-06-15',
    items: [],
    subtotal: 0,
    discountAmount: 0,
    taxPercent: 0,
    taxAmount: 0,
    total: 0,
    paymentMethod: 'cash',
    status: 'completed',
    notes: '',
    createdAt: '2026-06-15T09:00:00.000Z',
    completedAt: '2026-06-15T10:00:00.000Z',
    ...overrides,
  }
}

function rule(overrides: Partial<ScheduleRule> = {}): ScheduleRule {
  return {
    id: `rule-${nextId++}`,
    vehicleId: 'v-1',
    itemTypeId: 'sit-oil',
    intervalKm: 5000,
    baseOdometer: 42_000,
    intervalMonths: null,
    baseDate: null,
    source: 'workshop_default',
    supersededAt: null,
    supersedesId: null,
    notes: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function event(overrides: Partial<ServiceEvent> = {}): ServiceEvent {
  return {
    id: `ev-${nextId++}`,
    vehicleId: 'v-1',
    workOrderId: null,
    date: '2026-01-10',
    odometerAtArrival: null,
    odometerAtService: 42_000,
    items: [
      { id: `evi-${nextId++}`, itemTypeId: 'sit-oil', action: 'changed', quantityLiters: 4, containerType: null, notes: '' },
    ],
    notes: '',
    createdAt: '2026-01-10T10:00:00.000Z',
    ...overrides,
  }
}

/** Defaults for the "nothing is due" baseline; each test overrides what it exercises. */
const baseline = {
  ticketItems: [] as WorkOrderItem[],
  dueLines: [],
  currentOdometer: 47_200,
  currentDate: new Date(2026, 6, 25),
  lastChangeByItemType: new Map<string, number>(),
  ruleItemTypeIds: new Set<string>(),
  intervalKmFor: () => 5_000,
}

describe('lastChangeOdometerByItemType', () => {
  it('takes the highest odometer per item type', () => {
    const map = lastChangeOdometerByItemType([
      event({ odometerAtService: 30_000 }),
      event({ odometerAtService: 42_000 }),
    ])
    expect(map.get('sit-oil')).toBe(42_000)
  })

  it('falls back to the arrival reading and skips events with no reading at all', () => {
    const map = lastChangeOdometerByItemType([
      event({ odometerAtService: null, odometerAtArrival: 38_000 }),
      event({ odometerAtService: null, odometerAtArrival: null }),
    ])
    expect(map.get('sit-oil')).toBe(38_000)
  })

  it('ignores top-ups — only a change resets the clock', () => {
    const map = lastChangeOdometerByItemType([
      event({
        odometerAtService: 45_000,
        items: [{ id: 'i1', itemTypeId: 'sit-oil', action: 'topped_up', quantityLiters: 1, containerType: null, notes: '' }],
      }),
    ])
    expect(map.has('sit-oil')).toBe(false)
  })
})

describe('serviceUsageCounts', () => {
  it('counts service lines on completed orders only', () => {
    const counts = serviceUsageCounts([
      order({ items: [item({ description: 'Tune Up' }), item({ description: 'Tune Up' })] }),
      order({ items: [item({ description: 'Tune Up' })], status: 'open' }),
    ])
    expect(counts.get('Tune Up')).toBe(2)
  })

  it('ignores product lines', () => {
    const counts = serviceUsageCounts([order({ items: [item({ description: 'Shell HX7', productId: 'p-1' })] })])
    expect(counts.has('Shell HX7')).toBe(false)
  })
})

describe('rankServicesByUsage', () => {
  it('sorts most-used first and keeps the shop order for ties', () => {
    const wash = service({ name: 'Cuci Mobil' })
    const tune = service({ name: 'Tune Up' })
    const oil = service({ name: 'Ganti Oli Mesin' })
    expect(rankServicesByUsage([wash, tune, oil], new Map([['Tune Up', 5]])).map(s => s.name)).toEqual([
      'Tune Up',
      'Cuci Mobil',
      'Ganti Oli Mesin',
    ])
  })
})

describe('suggestServices — schedule rule path', () => {
  it('suggests an item the odometer is past the mark for', () => {
    const oil = service()
    const [suggestion] = suggestServices({
      ...baseline,
      services: [oil],
      currentOdometer: 47_200,
      dueLines: [dueLine(47_000, ['sit-oil'])],
      ruleItemTypeIds: new Set(['sit-oil']),
    })
    expect(suggestion.reason).toEqual({ kind: 'overdue', byKm: 200 })
  })

  it('counts landing exactly on the mark as due', () => {
    const [suggestion] = suggestServices({
      ...baseline,
      services: [service()],
      currentOdometer: 47_000,
      dueLines: [dueLine(47_000, ['sit-oil'])],
      ruleItemTypeIds: new Set(['sit-oil']),
    })
    expect(suggestion.reason).toEqual({ kind: 'overdue', byKm: 0 })
  })

  it('says nothing while the mark is still ahead — "due soon" is not a suggestion', () => {
    const result = suggestServices({
      ...baseline,
      services: [service()],
      currentOdometer: 46_800,
      dueLines: [dueLine(47_000, ['sit-oil'])],
      ruleItemTypeIds: new Set(['sit-oil']),
    })
    expect(result).toEqual([])
  })

  it('suggests every scheduled item that is due, furthest past the mark first', () => {
    const oil = service({ name: 'Ganti Oli Mesin', serviceItemTypeId: 'sit-oil' })
    const filter = service({ name: 'Ganti Filter Oli', serviceItemTypeId: 'sit-filter' })
    const result = suggestServices({
      ...baseline,
      services: [filter, oil],
      currentOdometer: 47_200,
      dueLines: [
        dueLine(47_000, ['sit-filter']), // 200 past
        dueLine(45_000, ['sit-oil']),    // 2,200 past
      ],
      ruleItemTypeIds: new Set(['sit-oil', 'sit-filter']),
    })
    expect(result.map(s => s.service.name)).toEqual(['Ganti Oli Mesin', 'Ganti Filter Oli'])
  })
})

describe('suggestServices — schedule rule path, date axis', () => {
  it('suggests a months-only rule once its date mark has passed', () => {
    const brake = service({ name: 'Minyak Rem', serviceItemTypeId: 'sit-brake' })
    const [suggestion] = suggestServices({
      ...baseline,
      services: [brake],
      dueLines: [dateLine('2026-07-20', ['sit-brake'])],
      ruleItemTypeIds: new Set(['sit-brake']),
    })
    expect(suggestion.reason).toEqual({ kind: 'overdue_date', byDays: 5 })
  })

  it('says nothing while a months-only mark is still ahead', () => {
    const brake = service({ name: 'Minyak Rem', serviceItemTypeId: 'sit-brake' })
    const result = suggestServices({
      ...baseline,
      services: [brake],
      dueLines: [dateLine('2026-08-01', ['sit-brake'])],
      ruleItemTypeIds: new Set(['sit-brake']),
    })
    expect(result).toEqual([])
  })

  it('suggests a both-axes rule only once, as the km reason, when both axes are overdue', () => {
    const oil = service()
    const result = suggestServices({
      ...baseline,
      services: [oil],
      currentOdometer: 47_200,
      dueLines: [{ dueKm: 47_000, dueDate: '2026-07-01', itemTypeIds: ['sit-oil'] }],
      ruleItemTypeIds: new Set(['sit-oil']),
    })
    expect(result).toHaveLength(1)
    expect(result[0].reason.kind).toBe('overdue')
  })
})

describe('suggestServices — last-change fallback', () => {
  const noRule = { ...baseline, ruleItemTypeIds: new Set<string>() }

  it('suggests once a full interval has passed since the last change', () => {
    const [suggestion] = suggestServices({
      ...noRule,
      services: [service()],
      currentOdometer: 47_200,
      lastChangeByItemType: new Map([['sit-oil', 42_000]]),
    })
    expect(suggestion.reason).toEqual({ kind: 'interval_elapsed', sinceKm: 5_200 })
  })

  it('fires exactly on the interval and stays silent below it', () => {
    const args = { ...noRule, services: [service()], lastChangeByItemType: new Map([['sit-oil', 42_000]]) }
    expect(suggestServices({ ...args, currentOdometer: 47_000 })).toHaveLength(1)
    expect(suggestServices({ ...args, currentOdometer: 46_999 })).toEqual([])
  })

  it('respects a per-item-type interval', () => {
    const brake = service({ name: 'Minyak Rem', serviceItemTypeId: 'sit-brake' })
    const result = suggestServices({
      ...noRule,
      services: [brake],
      currentOdometer: 47_200,
      lastChangeByItemType: new Map([['sit-brake', 42_000]]),
      intervalKmFor: () => 20_000,
    })
    expect(result).toEqual([])
  })

  it('never applies to an item that has a live rule — the rule decides', () => {
    // Rule says the next mark is 50,000 (not reached), history says 5,200 km
    // ago. The rule wins and nothing is suggested.
    const result = suggestServices({
      ...baseline,
      services: [service()],
      currentOdometer: 47_200,
      dueLines: [dueLine(50_000, ['sit-oil'])],
      ruleItemTypeIds: new Set(['sit-oil']),
      lastChangeByItemType: new Map([['sit-oil', 42_000]]),
    })
    expect(result).toEqual([])
  })

  it('says nothing when the vehicle has no history for that item', () => {
    expect(suggestServices({ ...noRule, services: [service()] })).toEqual([])
  })
})

describe('suggestServices — exclusions and limits', () => {
  it('never suggests a service with no schedule tag', () => {
    const wash = service({ name: 'Cuci Mobil', serviceItemTypeId: null })
    expect(
      suggestServices({
        ...baseline,
        services: [wash],
        dueLines: [dueLine(40_000, ['sit-oil'])],
        lastChangeByItemType: new Map([['sit-oil', 10_000]]),
      })
    ).toEqual([])
  })

  it('drops an item the ticket is already changing', () => {
    const result = suggestServices({
      ...baseline,
      services: [service()],
      ticketItems: [item({ serviceItemTypeId: 'sit-oil' })],
      currentOdometer: 47_200,
      dueLines: [dueLine(45_000, ['sit-oil'])],
      ruleItemTypeIds: new Set(['sit-oil']),
    })
    expect(result).toEqual([])
  })

  it('shows a service once even when both paths could claim it', () => {
    const result = suggestServices({
      ...baseline,
      services: [service()],
      currentOdometer: 47_200,
      dueLines: [dueLine(45_000, ['sit-oil'])],
      lastChangeByItemType: new Map([['sit-oil', 42_000]]),
    })
    expect(result).toHaveLength(1)
    expect(result[0].reason.kind).toBe('overdue')
  })

  it('respects the limit', () => {
    const services = ['A', 'B', 'C', 'D', 'E'].map((name, i) =>
      service({ name, serviceItemTypeId: `sit-${i}` })
    )
    const args = {
      ...baseline,
      services,
      currentOdometer: 47_200,
      dueLines: services.map((_s, i) => dueLine(40_000 + i * 100, [`sit-${i}`])),
      ruleItemTypeIds: new Set(services.map((_s, i) => `sit-${i}`)),
    }
    expect(suggestServices(args)).toHaveLength(4)
    expect(suggestServices({ ...args, limit: 2 })).toHaveLength(2)
  })
})

describe('overdueServiceSuggestions', () => {
  it('is empty with no live rules at all', () => {
    expect(overdueServiceSuggestions([service()], [], 47_200, new Date(2026, 6, 25))).toEqual([])
  })

  it('is empty when the vehicle has nothing overdue yet', () => {
    // baseOdometer 42,000 + intervalKm 5,000 = due at 47,000; not there yet.
    const result = overdueServiceSuggestions([service()], [rule()], 46_800, new Date(2026, 6, 25))
    expect(result).toEqual([])
  })

  it('includes a km-overdue service', () => {
    const result = overdueServiceSuggestions([service()], [rule()], 47_200, new Date(2026, 6, 25))
    expect(result).toHaveLength(1)
    expect(result[0].reason).toEqual({ kind: 'overdue', byKm: 200 })
  })

  it('includes a date-overdue, months-only service', () => {
    const brakeRule = rule({ itemTypeId: 'sit-brake', intervalKm: null, baseOdometer: null, intervalMonths: 6, baseDate: '2026-01-01' })
    const brake = service({ name: 'Minyak Rem', serviceItemTypeId: 'sit-brake' })
    const result = overdueServiceSuggestions([brake], [brakeRule], 10_000, new Date(2026, 6, 25))
    expect(result).toHaveLength(1)
    expect(result[0].reason.kind).toBe('overdue_date')
  })

  it('excludes a due-soon (not yet overdue) service', () => {
    // 500 short of the mark — inside suggestServices' own "due soon" window, still not a suggestion.
    const result = overdueServiceSuggestions([service()], [rule()], 46_990, new Date(2026, 6, 25))
    expect(result).toEqual([])
  })

  it('excludes interval-elapsed items — no live rule means it is not "overdue" by Reminders\' definition', () => {
    // No rule at all for this item type; overdueServiceSuggestions never even
    // has a last-change history to fall back to (that path is deliberately unreachable).
    const result = overdueServiceSuggestions([service()], [], 90_000, new Date(2026, 6, 25))
    expect(result).toEqual([])
  })

  it('only counts live (non-superseded) rules', () => {
    const superseded = rule({ supersededAt: '2026-01-01T00:00:00.000Z' })
    const result = overdueServiceSuggestions([service()], [superseded], 47_200, new Date(2026, 6, 25))
    expect(result).toEqual([])
  })
})
