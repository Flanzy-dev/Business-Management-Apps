// src/lib/ops/scheduleRuleOrphanRepair.ts — the one-time cleanup for
// ScheduleRule rows orphaned by the (now-fixed) service-item-type reseed
// bug. Same createXOps(deps) + fake-store pattern as costingBackfill.test.ts.
import { describe, it, expect } from 'vitest'
import { createScheduleRuleOrphanRepairOps } from '../ops/scheduleRuleOrphanRepair'
import { buildFakeOpsDeps } from './helpers/fakeOpsDeps'

function scheduleRule(overrides: Record<string, unknown> = {}) {
  return {
    id: `sr-${Math.random().toString(36).slice(2)}`,
    vehicleId: 'v-1',
    itemTypeId: 'it-1',
    intervalKm: 5000,
    baseOdometer: 10_000,
    intervalMonths: null,
    baseDate: null,
    source: 'workshop_default' as const,
    supersededAt: null,
    supersedesId: null,
    sourceOrderId: null,
    notes: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('repairOrphanedScheduleRules', () => {
  it('supersedes live rules whose itemTypeId matches no current service item type', () => {
    const world = buildFakeOpsDeps({
      serviceItemTypes: [{ id: 'it-1', name: 'Oli Mesin' }],
      scheduleRules: [
        scheduleRule({ id: 'sr-orphan', itemTypeId: 'it-stale-from-a-past-reseed' }),
        scheduleRule({ id: 'sr-valid', itemTypeId: 'it-1' }),
      ],
    })
    const { repairOrphanedScheduleRules } = createScheduleRuleOrphanRepairOps(world.deps)

    repairOrphanedScheduleRules()

    expect(world.scheduleRules.getRule('sr-orphan')?.supersededAt).not.toBeNull()
    expect(world.scheduleRules.getRule('sr-valid')?.supersededAt).toBeNull()
  })

  it('leaves already-superseded orphans alone (nothing left to do)', () => {
    const world = buildFakeOpsDeps({
      serviceItemTypes: [{ id: 'it-1', name: 'Oli Mesin' }],
      scheduleRules: [
        scheduleRule({ id: 'sr-old-orphan', itemTypeId: 'it-gone', supersededAt: '2026-01-02T00:00:00.000Z' }),
      ],
    })
    const { repairOrphanedScheduleRules } = createScheduleRuleOrphanRepairOps(world.deps)

    repairOrphanedScheduleRules()

    expect(world.scheduleRules.getRule('sr-old-orphan')?.supersededAt).toBe('2026-01-02T00:00:00.000Z')
  })

  it('marks itself repaired, and is a no-op on a second run', () => {
    const world = buildFakeOpsDeps({
      serviceItemTypes: [{ id: 'it-1', name: 'Oli Mesin' }],
      scheduleRules: [scheduleRule({ id: 'sr-orphan', itemTypeId: 'it-gone' })],
    })
    const { repairOrphanedScheduleRules } = createScheduleRuleOrphanRepairOps(world.deps)

    repairOrphanedScheduleRules()
    expect(world.scheduleRules.orphanRepairedAt).not.toBeNull()

    // Simulate a rule that shows up *after* the repair already ran (e.g. a
    // late sync pull) — the guard means it's deliberately left untouched,
    // matching the same limitation costingBackfill/stockLedgerBackfill have.
    world.scheduleRules.scheduleRules.push(scheduleRule({ id: 'sr-late-orphan', itemTypeId: 'it-also-gone' }))

    repairOrphanedScheduleRules()

    expect(world.scheduleRules.getRule('sr-late-orphan')?.supersededAt).toBeNull()
  })

  it('does nothing when every live rule already matches a current item type', () => {
    const world = buildFakeOpsDeps({
      serviceItemTypes: [{ id: 'it-1', name: 'Oli Mesin' }],
      scheduleRules: [scheduleRule({ id: 'sr-valid', itemTypeId: 'it-1' })],
    })
    const { repairOrphanedScheduleRules } = createScheduleRuleOrphanRepairOps(world.deps)

    repairOrphanedScheduleRules()

    expect(world.scheduleRules.getRule('sr-valid')?.supersededAt).toBeNull()
    expect(world.scheduleRules.orphanRepairedAt).not.toBeNull()
  })
})
