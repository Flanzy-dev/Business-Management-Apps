// src/lib/ops/scheduleOps.ts already takes injected deps (createScheduleOps)
// and has a bound default export like every other ops file — it just had no
// tests yet, unlike orderOps/entityOps/inventoryOps/productCatalogOps.
import { describe, it, expect } from 'vitest'
import { createScheduleOps } from '../ops/scheduleOps'
import { buildFakeOpsDeps } from './helpers/fakeOpsDeps'

describe('scheduleOps', () => {
  describe('setScheduleRule', () => {
    it('creates a fresh rule with no predecessor when none exists yet', () => {
      const world = buildFakeOpsDeps()
      const { setScheduleRule } = createScheduleOps(world.deps)

      const rule = setScheduleRule('v-1', 'it-1', {
        intervalKm: 5000,
        baseOdometer: 10_000,
        source: 'workshop_default',
      })

      expect(rule.supersedesId).toBeNull()
      expect(world.scheduleRules.scheduleRules).toHaveLength(1)
    })

    it('supersedes the previous live rule and links back to it, never leaving two live rules', () => {
      const world = buildFakeOpsDeps()
      const { setScheduleRule } = createScheduleOps(world.deps)

      const first = setScheduleRule('v-1', 'it-1', { intervalKm: 5000, baseOdometer: 10_000, source: 'workshop_default' })
      const second = setScheduleRule('v-1', 'it-1', { intervalKm: 3000, baseOdometer: 12_000, source: 'customer_request' })

      expect(second.supersedesId).toBe(first.id)
      const live = world.scheduleRules.scheduleRules.filter((r) => r.supersededAt === null)
      expect(live).toEqual([expect.objectContaining({ id: second.id })])
    })

    // Sync's per-row merge can leave two live rules for the same vehicle+item
    // pair (see scheduleRuleStore.ts's interface doc comment) — two devices
    // each superseding the one they saw and inserting their own replacement.
    // A single-device save has to collapse that back to one live rule, not
    // just add a third on top of it.
    it('collapses two pre-existing live duplicates into one on save, chaining back to the newest of them', () => {
      const world = buildFakeOpsDeps({
        scheduleRules: [
          {
            id: 'sr-old', vehicleId: 'v-1', itemTypeId: 'it-1',
            intervalKm: 5000, baseOdometer: 10_000, intervalMonths: null, baseDate: null,
            source: 'workshop_default', supersededAt: null, supersedesId: null, sourceOrderId: null,
            notes: '', createdAt: '2026-01-01T00:00:00.000Z',
          },
          {
            id: 'sr-new', vehicleId: 'v-1', itemTypeId: 'it-1',
            intervalKm: 3000, baseOdometer: 12_000, intervalMonths: null, baseDate: null,
            source: 'customer_request', supersededAt: null, supersedesId: null, sourceOrderId: null,
            notes: '', createdAt: '2026-02-01T00:00:00.000Z',
          },
        ],
      })
      const { setScheduleRule } = createScheduleOps(world.deps)

      const result = setScheduleRule('v-1', 'it-1', { intervalKm: 8000, baseOdometer: 20_000, source: 'workshop_default' })

      const live = world.scheduleRules.scheduleRules.filter((r) => r.supersededAt === null)
      expect(live).toEqual([expect.objectContaining({ id: result.id })])
      expect(result.supersedesId).toBe('sr-new')
    })
  })

  describe('deleteScheduleRule', () => {
    it('supersedes the rule with no replacement, leaving the vehicle with no active rule', () => {
      const world = buildFakeOpsDeps()
      const { setScheduleRule, deleteScheduleRule } = createScheduleOps(world.deps)
      const rule = setScheduleRule('v-1', 'it-1', { intervalKm: 5000, baseOdometer: 0, source: 'workshop_default' })

      deleteScheduleRule(rule.id)

      expect(world.scheduleRules.getActiveRule('v-1', 'it-1')).toBeUndefined()
    })

    it('deleting one of several duplicate live rules supersedes every sibling, not just the one named', () => {
      const world = buildFakeOpsDeps({
        scheduleRules: [
          {
            id: 'sr-a', vehicleId: 'v-1', itemTypeId: 'it-1',
            intervalKm: 5000, baseOdometer: 10_000, intervalMonths: null, baseDate: null,
            source: 'workshop_default', supersededAt: null, supersedesId: null, sourceOrderId: null,
            notes: '', createdAt: '2026-01-01T00:00:00.000Z',
          },
          {
            id: 'sr-b', vehicleId: 'v-1', itemTypeId: 'it-1',
            intervalKm: 3000, baseOdometer: 12_000, intervalMonths: null, baseDate: null,
            source: 'customer_request', supersededAt: null, supersedesId: null, sourceOrderId: null,
            notes: '', createdAt: '2026-02-01T00:00:00.000Z',
          },
        ],
      })
      const { deleteScheduleRule } = createScheduleOps(world.deps)

      deleteScheduleRule('sr-a')

      expect(world.scheduleRules.getActiveRule('v-1', 'it-1')).toBeUndefined()
      expect(world.scheduleRules.scheduleRules.every((r) => r.supersededAt !== null)).toBe(true)
    })
  })

  describe('applyChangedServiceToSchedule', () => {
    it('creates a rule from the catalog interval when none existed and nothing was requested', () => {
      const world = buildFakeOpsDeps({
        services: [{ id: 's-1', serviceItemTypeId: 'it-1', intervalKm: 8000, intervalMonths: null, isDefaultForItemType: false }],
      })
      const { applyChangedServiceToSchedule } = createScheduleOps(world.deps)

      applyChangedServiceToSchedule('v-1', 'it-1', 'wo-1', { newBaseOdometer: 20_000 })

      const active = world.scheduleRules.getActiveRule('v-1', 'it-1')
      expect(active).toMatchObject({ intervalKm: 8000, baseOdometer: 20_000, source: 'workshop_default', sourceOrderId: 'wo-1' })
    })

    it('creates a months-only rule from a months-only catalog match, without a spurious km axis', () => {
      const world = buildFakeOpsDeps({
        services: [{ id: 's-1', serviceItemTypeId: 'it-brake', intervalKm: null, intervalMonths: 24, isDefaultForItemType: false }],
      })
      const { applyChangedServiceToSchedule } = createScheduleOps(world.deps)

      applyChangedServiceToSchedule('v-1', 'it-brake', 'wo-1', { newBaseOdometer: 20_000, newBaseDate: '2026-07-01' })

      const active = world.scheduleRules.getActiveRule('v-1', 'it-brake')
      expect(active).toMatchObject({ intervalKm: null, baseOdometer: null, intervalMonths: 24, baseDate: '2026-07-01' })
    })

    it('falls back to the shop-wide default km/months pair when the catalog has nothing for this item', () => {
      const world = buildFakeOpsDeps({ defaultServiceIntervalKm: 7500, defaultServiceIntervalMonths: 5 })
      const { applyChangedServiceToSchedule } = createScheduleOps(world.deps)

      applyChangedServiceToSchedule('v-1', 'it-1', 'wo-1', { newBaseOdometer: 20_000, newBaseDate: '2026-08-10' })

      const active = world.scheduleRules.getActiveRule('v-1', 'it-1')
      expect(active).toMatchObject({
        intervalKm: 7500,
        baseOdometer: 20_000,
        intervalMonths: 5,
        baseDate: '2026-08-10',
        source: 'workshop_default',
      })
    })

    it("keeps a km-only catalog match km-only, not adding the shop's months default on top", () => {
      const world = buildFakeOpsDeps({
        services: [{ id: 's-1', serviceItemTypeId: 'it-tuneup', intervalKm: 20_000, intervalMonths: null, isDefaultForItemType: false }],
        defaultServiceIntervalMonths: 5,
      })
      const { applyChangedServiceToSchedule } = createScheduleOps(world.deps)

      applyChangedServiceToSchedule('v-1', 'it-tuneup', 'wo-1', { newBaseOdometer: 20_000 })

      const active = world.scheduleRules.getActiveRule('v-1', 'it-tuneup')
      expect(active).toMatchObject({ intervalKm: 20_000, intervalMonths: null, baseDate: null })
    })

    it('creates a rule outright from a customer-requested interval when none existed, ignoring the catalog', () => {
      const world = buildFakeOpsDeps({
        services: [{ id: 's-1', serviceItemTypeId: 'it-1', intervalKm: 8000, intervalMonths: null, isDefaultForItemType: false }],
      })
      const { applyChangedServiceToSchedule } = createScheduleOps(world.deps)

      applyChangedServiceToSchedule('v-1', 'it-1', 'wo-1', { newBaseOdometer: 20_000, requestedIntervalKm: 3000 })

      const active = world.scheduleRules.getActiveRule('v-1', 'it-1')
      expect(active).toMatchObject({ intervalKm: 3000, baseOdometer: 20_000, source: 'customer_request', sourceOrderId: 'wo-1' })
    })

    it('moves an existing rule\'s base to the new odometer/date, keeping its interval', () => {
      const world = buildFakeOpsDeps()
      const { setScheduleRule, applyChangedServiceToSchedule } = createScheduleOps(world.deps)
      setScheduleRule('v-1', 'it-1', { intervalKm: 5000, baseOdometer: 10_000, source: 'workshop_default' })

      applyChangedServiceToSchedule('v-1', 'it-1', 'wo-1', { newBaseOdometer: 15_000, newBaseDate: '2026-02-01' })

      const active = world.scheduleRules.getActiveRule('v-1', 'it-1')
      expect(active).toMatchObject({ intervalKm: 5000, baseOdometer: 15_000, source: 'workshop_default', sourceOrderId: 'wo-1' })
    })

    it('overrides the interval and marks the rule customer_request when a specific interval is requested', () => {
      const world = buildFakeOpsDeps()
      const { setScheduleRule, applyChangedServiceToSchedule } = createScheduleOps(world.deps)
      setScheduleRule('v-1', 'it-1', { intervalKm: 5000, baseOdometer: 10_000, source: 'workshop_default' })

      applyChangedServiceToSchedule('v-1', 'it-1', 'wo-1', { newBaseOdometer: 15_000, requestedIntervalKm: 3000 })

      const active = world.scheduleRules.getActiveRule('v-1', 'it-1')
      expect(active).toMatchObject({ intervalKm: 3000, source: 'customer_request' })
    })
  })

  describe('unwindScheduleForOrder', () => {
    it("restores the superseded predecessor an order's service moved past", () => {
      const world = buildFakeOpsDeps()
      const { setScheduleRule, applyChangedServiceToSchedule, unwindScheduleForOrder } = createScheduleOps(world.deps)
      const original = setScheduleRule('v-1', 'it-1', { intervalKm: 5000, baseOdometer: 10_000, source: 'workshop_default' })

      applyChangedServiceToSchedule('v-1', 'it-1', 'wo-1', { newBaseOdometer: 15_000 })
      unwindScheduleForOrder('wo-1')

      const active = world.scheduleRules.getActiveRule('v-1', 'it-1')
      expect(active?.id).toBe(original.id)
      expect(active?.baseOdometer).toBe(10_000)
    })

    it('removes a rule the order created outright, leaving no live rule', () => {
      const world = buildFakeOpsDeps()
      const { applyChangedServiceToSchedule, unwindScheduleForOrder } = createScheduleOps(world.deps)

      applyChangedServiceToSchedule('v-1', 'it-1', 'wo-1', { newBaseOdometer: 20_000, requestedIntervalKm: 3000 })
      unwindScheduleForOrder('wo-1')

      expect(world.scheduleRules.getActiveRule('v-1', 'it-1')).toBeUndefined()
    })

    it("leaves a newer order's rule untouched when unwinding an older order", () => {
      const world = buildFakeOpsDeps()
      const { setScheduleRule, applyChangedServiceToSchedule, unwindScheduleForOrder } = createScheduleOps(world.deps)
      setScheduleRule('v-1', 'it-1', { intervalKm: 5000, baseOdometer: 10_000, source: 'workshop_default' })

      applyChangedServiceToSchedule('v-1', 'it-1', 'wo-1', { newBaseOdometer: 15_000 })
      applyChangedServiceToSchedule('v-1', 'it-1', 'wo-2', { newBaseOdometer: 20_000 })
      unwindScheduleForOrder('wo-1')

      const active = world.scheduleRules.getActiveRule('v-1', 'it-1')
      expect(active?.baseOdometer).toBe(20_000)
      expect(active?.sourceOrderId).toBe('wo-2')
    })

    it('does nothing for an order that never moved a schedule', () => {
      const world = buildFakeOpsDeps()
      const { unwindScheduleForOrder } = createScheduleOps(world.deps)
      expect(() => unwindScheduleForOrder('wo-none')).not.toThrow()
      expect(world.scheduleRules.scheduleRules).toHaveLength(0)
    })

    // The guard scheduleRuleStore.ts's reviveRule doc comment describes:
    // reviving a predecessor behind a rule that's still live for the same
    // vehicle+item pair would recreate the exact two-live-rules duplicate
    // this store's invariant exists to rule out. That "still live" rule can
    // be a completely independent one — e.g. another device set its own
    // schedule for this item while this device was offline unwinding an
    // older order — not just a later order on the same device.
    it('does not revive the predecessor when another live rule already occupies the pair', () => {
      const world = buildFakeOpsDeps({
        scheduleRules: [
          {
            id: 'sr-pred', vehicleId: 'v-1', itemTypeId: 'it-1',
            intervalKm: 5000, baseOdometer: 10_000, intervalMonths: null, baseDate: null,
            source: 'workshop_default', supersededAt: '2026-01-15T00:00:00.000Z', supersedesId: null,
            sourceOrderId: null, notes: '', createdAt: '2026-01-01T00:00:00.000Z',
          },
          {
            id: 'sr-from-order', vehicleId: 'v-1', itemTypeId: 'it-1',
            intervalKm: 5000, baseOdometer: 15_000, intervalMonths: null, baseDate: null,
            source: 'workshop_default', supersededAt: null, supersedesId: 'sr-pred',
            sourceOrderId: 'wo-1', notes: '', createdAt: '2026-01-15T00:00:00.000Z',
          },
          // Simulates another device's independent edit landing via sync
          // while this device still holds the (now stale) sr-from-order.
          {
            id: 'sr-other-device', vehicleId: 'v-1', itemTypeId: 'it-1',
            intervalKm: 3000, baseOdometer: 18_000, intervalMonths: null, baseDate: null,
            source: 'customer_request', supersededAt: null, supersedesId: null,
            sourceOrderId: null, notes: '', createdAt: '2026-01-20T00:00:00.000Z',
          },
        ],
      })
      const { unwindScheduleForOrder } = createScheduleOps(world.deps)

      unwindScheduleForOrder('wo-1')

      const active = world.scheduleRules.getActiveRule('v-1', 'it-1')
      expect(active?.id).toBe('sr-other-device')
      expect(world.scheduleRules.getRule('sr-pred')?.supersededAt).not.toBeNull()
      expect(world.scheduleRules.getRule('sr-from-order')?.supersededAt).not.toBeNull()
    })
  })

  describe('seedDefaultScheduleRules', () => {
    it('seeds one rule per item type with an unambiguous catalog match, skipping ambiguous ones', () => {
      const world = buildFakeOpsDeps({
        serviceItemTypes: [{ id: 'it-oil', name: 'Oli Mesin' }, { id: 'it-filter', name: 'Filter Oli' }],
        services: [
          { id: 's-1', serviceItemTypeId: 'it-oil', intervalKm: 5000, intervalMonths: null, isDefaultForItemType: false },
          // Two candidates for it-filter with neither marked default: ambiguous, skipped.
          { id: 's-2', serviceItemTypeId: 'it-filter', intervalKm: 10_000, intervalMonths: null, isDefaultForItemType: false },
          { id: 's-3', serviceItemTypeId: 'it-filter', intervalKm: 8000, intervalMonths: null, isDefaultForItemType: false },
        ],
      })
      const { seedDefaultScheduleRules } = createScheduleOps(world.deps)

      const seeded = seedDefaultScheduleRules('v-1', 12_000)

      expect(seeded).toHaveLength(1)
      expect(seeded[0]).toMatchObject({ itemTypeId: 'it-oil', intervalKm: 5000, baseOdometer: 12_000, source: 'workshop_default' })
    })

    it('seeds base odometer 0 when the vehicle has no mileage recorded yet', () => {
      const world = buildFakeOpsDeps({
        serviceItemTypes: [{ id: 'it-oil', name: 'Oli Mesin' }],
        services: [{ id: 's-1', serviceItemTypeId: 'it-oil', intervalKm: 5000, intervalMonths: null, isDefaultForItemType: false }],
      })
      const { seedDefaultScheduleRules } = createScheduleOps(world.deps)

      const seeded = seedDefaultScheduleRules('v-1', null)

      expect(seeded[0].baseOdometer).toBe(0)
    })

    // Used by createVehicleWithSchedule's customer_interval branch to filter
    // which item types even get considered — an item type resolvable from
    // the catalog but left off the list must not get seeded, even though
    // seeding it "for free" would be harmless for that one item type in
    // isolation.
    it('seeds only the named item types when a filter list is given, leaving an otherwise-resolvable one out', () => {
      const world = buildFakeOpsDeps({
        serviceItemTypes: [{ id: 'it-oil', name: 'Oli Mesin' }, { id: 'it-filter', name: 'Filter Oli' }],
        services: [
          { id: 's-1', serviceItemTypeId: 'it-oil', intervalKm: 5000, intervalMonths: null, isDefaultForItemType: false },
          { id: 's-2', serviceItemTypeId: 'it-filter', intervalKm: 15_000, intervalMonths: null, isDefaultForItemType: false },
        ],
      })
      const { seedDefaultScheduleRules } = createScheduleOps(world.deps)

      const seeded = seedDefaultScheduleRules('v-1', 12_000, ['it-oil'])

      expect(seeded).toHaveLength(1)
      expect(seeded[0]).toMatchObject({ itemTypeId: 'it-oil' })
    })
  })

  describe('seedScheduleRulesFromServices', () => {
    it('seeds a rule per named service, keyed by the service\'s own item type and interval', () => {
      const world = buildFakeOpsDeps({
        serviceItemTypes: [{ id: 'it-trans', name: 'Oli Transmisi' }],
        services: [
          { id: 's-manual', serviceItemTypeId: 'it-trans', intervalKm: 15_000, intervalMonths: null, isDefaultForItemType: false },
          { id: 's-matic', serviceItemTypeId: 'it-trans', intervalKm: 25_000, intervalMonths: null, isDefaultForItemType: false },
        ],
      })
      const { seedScheduleRulesFromServices } = createScheduleOps(world.deps)

      // Only the matic candidate is picked — the Add Vehicle checklist's job
      // is exactly this: choosing one out of an otherwise-ambiguous tag.
      const seeded = seedScheduleRulesFromServices('v-1', 12_000, ['s-matic'])

      expect(seeded).toHaveLength(1)
      expect(seeded[0]).toMatchObject({ itemTypeId: 'it-trans', intervalKm: 25_000, baseOdometer: 12_000, source: 'workshop_default' })
    })

    it('skips an id with no matching service, no item type, or no interval, rather than erroring', () => {
      const world = buildFakeOpsDeps({
        serviceItemTypes: [{ id: 'it-oil', name: 'Oli Mesin' }],
        services: [
          { id: 's-oil', serviceItemTypeId: 'it-oil', intervalKm: 5000, intervalMonths: null, isDefaultForItemType: false },
          { id: 's-untagged', serviceItemTypeId: null, intervalKm: 5000, intervalMonths: null, isDefaultForItemType: false },
          { id: 's-no-interval', serviceItemTypeId: 'it-oil', intervalKm: null, intervalMonths: null, isDefaultForItemType: false },
        ],
      })
      const { seedScheduleRulesFromServices } = createScheduleOps(world.deps)

      const seeded = seedScheduleRulesFromServices('v-1', 12_000, ['s-oil', 's-untagged', 's-no-interval', 's-ghost'])

      expect(seeded).toHaveLength(1)
      expect(seeded[0]).toMatchObject({ itemTypeId: 'it-oil' })
    })
  })
})
