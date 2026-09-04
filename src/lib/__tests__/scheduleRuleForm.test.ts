// The per-vehicle schedule setup form's rules, now that they live outside the
// component (see src/lib/scheduleRuleForm.ts's header for why that matters,
// mirroring vehicleForm.test.ts for VehicleModal.tsx). The cases worth having
// are the ones a shop would notice: the right thing prefills for each of the
// three starting points, and a half-filled axis must not save.
import { describe, it, expect } from 'vitest'
import {
  emptyScheduleDraft,
  scheduleDraftFor,
  validateScheduleDraft,
  scheduleDraftToRuleData,
  scheduleRuleSummary,
  type ScheduleRuleDraft,
} from '../scheduleRuleForm'
import type { ScheduleRule } from '../../store/scheduleRuleStore'
import type { ServiceCatalogItem } from '../../store/serviceCatalogStore'

function rule(overrides: Partial<ScheduleRule> = {}): ScheduleRule {
  return {
    id: 'rule-1',
    vehicleId: 'v-1',
    itemTypeId: 'sit-oil',
    intervalKm: 5000,
    baseOdometer: 10_000,
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

function catalogItem(overrides: Partial<ServiceCatalogItem> = {}): ServiceCatalogItem {
  return {
    id: 'svc-1',
    name: 'Ganti Oli Mesin',
    price: 50_000,
    serviceItemTypeId: 'sit-oil',
    notes: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

const shopDefaults = { km: 5000, months: 4 }

describe('scheduleDraftFor', () => {
  it('loads an existing live rule for editing, deriving its axis', () => {
    const { draft, prefilledFrom } = scheduleDraftFor(
      rule({ intervalKm: 15000, baseOdometer: 40_000, intervalMonths: 12, baseDate: '2026-06-01' }),
      null,
      shopDefaults,
      50_000,
      '2026-08-10'
    )
    expect(draft).toEqual<ScheduleRuleDraft>({
      axis: 'both',
      intervalKm: '15000',
      baseOdometer: '40000',
      intervalMonths: '12',
      baseDate: '2026-06-01',
      source: 'workshop_default',
    })
    expect(prefilledFrom).toBeNull()
  })

  it('prefills from a months-only catalog match without a spurious km axis', () => {
    const { draft, prefilledFrom } = scheduleDraftFor(
      undefined,
      catalogItem({ name: 'Minyak Rem', intervalKm: null, intervalMonths: 24 }),
      shopDefaults,
      50_000,
      '2026-08-10'
    )
    expect(draft.axis).toBe('months')
    expect(draft.intervalKm).toBe('')
    expect(draft.intervalMonths).toBe('24')
    expect(draft.baseOdometer).toBe('50000')
    expect(draft.baseDate).toBe('2026-08-10')
    expect(prefilledFrom).toEqual({ kind: 'service', name: 'Minyak Rem' })
  })

  it('prefills both axes from the catalog match when it carries both', () => {
    const { draft } = scheduleDraftFor(undefined, catalogItem({ intervalKm: 5000, intervalMonths: 4 }), shopDefaults, null, '2026-08-10')
    expect(draft.axis).toBe('both')
    expect(draft.intervalKm).toBe('5000')
    expect(draft.intervalMonths).toBe('4')
  })

  it('falls back to the shop-wide km/months pair together when there is no catalog match', () => {
    const { draft, prefilledFrom } = scheduleDraftFor(undefined, null, { km: 7500, months: 5 }, 20_000, '2026-08-10')
    expect(draft).toEqual<ScheduleRuleDraft>({
      axis: 'both',
      intervalKm: '7500',
      baseOdometer: '20000',
      intervalMonths: '5',
      baseDate: '2026-08-10',
      source: 'workshop_default',
    })
    expect(prefilledFrom).toEqual({ kind: 'shop_default' })
  })

  it('leaves the base odometer blank when the vehicle has no recorded mileage', () => {
    const { draft } = scheduleDraftFor(undefined, null, shopDefaults, null, '2026-08-10')
    expect(draft.baseOdometer).toBe('')
  })
})

describe('validateScheduleDraft', () => {
  it('is valid when the single selected axis has both its interval and base', () => {
    const draft: ScheduleRuleDraft = { ...emptyScheduleDraft(), axis: 'km', intervalKm: '5000', baseOdometer: '10000' }
    expect(validateScheduleDraft(draft)).toEqual({ ok: true })
  })

  it('is invalid when the selected axis is missing its base', () => {
    const draft: ScheduleRuleDraft = { ...emptyScheduleDraft(), axis: 'km', intervalKm: '5000', baseOdometer: '' }
    expect(validateScheduleDraft(draft)).toEqual({ ok: false })
  })

  it('requires both axes complete on "both", not just one', () => {
    const draft: ScheduleRuleDraft = {
      ...emptyScheduleDraft(),
      axis: 'both',
      intervalKm: '5000',
      baseOdometer: '10000',
      intervalMonths: '',
      baseDate: '',
    }
    expect(validateScheduleDraft(draft)).toEqual({ ok: false })
  })

  it('is valid on "both" once both axes are complete', () => {
    const draft: ScheduleRuleDraft = {
      ...emptyScheduleDraft(),
      axis: 'both',
      intervalKm: '5000',
      baseOdometer: '10000',
      intervalMonths: '4',
      baseDate: '2026-08-10',
    }
    expect(validateScheduleDraft(draft)).toEqual({ ok: true })
  })
})

describe('scheduleDraftToRuleData', () => {
  it('nulls out the months axis when only km is selected, even if months was typed', () => {
    const draft: ScheduleRuleDraft = {
      axis: 'km',
      intervalKm: '5000',
      baseOdometer: '10000',
      intervalMonths: '4',
      baseDate: '2026-08-10',
      source: 'workshop_default',
    }
    expect(scheduleDraftToRuleData(draft)).toEqual({
      intervalKm: 5000,
      baseOdometer: 10000,
      intervalMonths: null,
      baseDate: null,
      source: 'workshop_default',
    })
  })

  it('nulls out the km axis when only months is selected, even if km was typed', () => {
    const draft: ScheduleRuleDraft = {
      axis: 'months',
      intervalKm: '5000',
      baseOdometer: '10000',
      intervalMonths: '4',
      baseDate: '2026-08-10',
      source: 'customer_request',
    }
    expect(scheduleDraftToRuleData(draft)).toEqual({
      intervalKm: null,
      baseOdometer: null,
      intervalMonths: 4,
      baseDate: '2026-08-10',
      source: 'customer_request',
    })
  })

  it('keeps both axes on "both"', () => {
    const draft: ScheduleRuleDraft = {
      axis: 'both',
      intervalKm: '5000',
      baseOdometer: '10000',
      intervalMonths: '4',
      baseDate: '2026-08-10',
      source: 'workshop_default',
    }
    expect(scheduleDraftToRuleData(draft)).toEqual({
      intervalKm: 5000,
      baseOdometer: 10000,
      intervalMonths: 4,
      baseDate: '2026-08-10',
      source: 'workshop_default',
    })
  })
})

describe('scheduleRuleSummary', () => {
  it('reports the km part when the rule tracks it', () => {
    const summary = scheduleRuleSummary(rule({ intervalKm: 5000, baseOdometer: 10_000, intervalMonths: null, baseDate: null }))
    expect(summary.kmPart).toEqual({ interval: '5,000', base: '10,000' })
    expect(summary.monthsPart).toBeNull()
  })

  it('reports the months part when the rule tracks it', () => {
    const summary = scheduleRuleSummary(rule({ intervalKm: null, baseOdometer: null, intervalMonths: 4, baseDate: '2026-08-10' }))
    expect(summary.kmPart).toBeNull()
    expect(summary.monthsPart).toEqual({ months: 4, base: expect.any(String) })
  })

  it('reports both parts on a "both"-axis rule', () => {
    const summary = scheduleRuleSummary(rule({ intervalKm: 5000, baseOdometer: 10_000, intervalMonths: 4, baseDate: '2026-08-10' }))
    expect(summary.kmPart).not.toBeNull()
    expect(summary.monthsPart).not.toBeNull()
  })

  it('nulls out an axis missing its base, even if the interval is set', () => {
    const summary = scheduleRuleSummary(rule({ intervalKm: 5000, baseOdometer: null }))
    expect(summary.kmPart).toBeNull()
  })

  it('flags customer_request vs. workshop_default', () => {
    expect(scheduleRuleSummary(rule({ source: 'customer_request' })).isCustomerRequest).toBe(true)
    expect(scheduleRuleSummary(rule({ source: 'workshop_default' })).isCustomerRequest).toBe(false)
  })
})
