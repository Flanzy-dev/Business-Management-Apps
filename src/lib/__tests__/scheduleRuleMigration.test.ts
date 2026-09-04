// The v0->v1 repair for pre-existing duplicate live schedule rules — see
// scheduleRuleStore.ts's collapseDuplicateLiveRules and its persist migrate
// hook. Pure function under test, no persist/zustand machinery needed (same
// reasoning as scheduleEngine.ts's own tests).
import { describe, it, expect } from 'vitest'
import { collapseDuplicateLiveRules, newestRule, type ScheduleRule } from '../../store/scheduleRuleStore'

let nextId = 1

function rule(overrides: Partial<ScheduleRule> = {}): ScheduleRule {
  return {
    id: `rule-${nextId++}`,
    vehicleId: 'v-1',
    itemTypeId: 'it-1',
    intervalKm: 5000,
    baseOdometer: 10_000,
    intervalMonths: null,
    baseDate: null,
    source: 'workshop_default',
    supersededAt: null,
    supersedesId: null,
    sourceOrderId: null,
    notes: '',
    createdAt: new Date(2026, 0, 1).toISOString(),
    ...overrides,
  }
}

describe('newestRule', () => {
  it('picks the rule with the latest createdAt', () => {
    const older = rule({ createdAt: '2026-01-01T00:00:00.000Z' })
    const newer = rule({ createdAt: '2026-02-01T00:00:00.000Z' })
    expect(newestRule([older, newer])?.id).toBe(newer.id)
    expect(newestRule([newer, older])?.id).toBe(newer.id)
  })

  it('breaks a createdAt tie by id, the same way regardless of input order', () => {
    const a = rule({ id: 'aaa', createdAt: '2026-01-01T00:00:00.000Z' })
    const b = rule({ id: 'bbb', createdAt: '2026-01-01T00:00:00.000Z' })
    expect(newestRule([a, b])?.id).toBe('bbb')
    expect(newestRule([b, a])?.id).toBe('bbb')
  })

  it('returns undefined for an empty list', () => {
    expect(newestRule([])).toBeUndefined()
  })
})

describe('collapseDuplicateLiveRules', () => {
  it('supersedes every live rule but the newest for a duplicated vehicle+item pair', () => {
    const older = rule({ id: 'sr-old', createdAt: '2026-01-01T00:00:00.000Z' })
    const newer = rule({ id: 'sr-new', createdAt: '2026-02-01T00:00:00.000Z' })

    const result = collapseDuplicateLiveRules([older, newer])

    const live = result.filter((r) => r.supersededAt === null)
    expect(live).toEqual([expect.objectContaining({ id: 'sr-new' })])
    expect(result.find((r) => r.id === 'sr-old')?.supersededAt).not.toBeNull()
  })

  it('leaves already-correct data (at most one live rule per pair) completely untouched', () => {
    const rules = [
      rule({ id: 'sr-1', itemTypeId: 'it-1', supersededAt: null }),
      rule({ id: 'sr-2', itemTypeId: 'it-2', supersededAt: null }),
      rule({ id: 'sr-3', itemTypeId: 'it-1', supersededAt: '2026-01-05T00:00:00.000Z' }),
    ]
    expect(collapseDuplicateLiveRules(rules)).toBe(rules) // same reference — no-op, not just equal
  })

  it('is idempotent — running it twice produces the same result as running it once', () => {
    const rules = [
      rule({ id: 'sr-old', itemTypeId: 'it-1', createdAt: '2026-01-01T00:00:00.000Z' }),
      rule({ id: 'sr-new', itemTypeId: 'it-1', createdAt: '2026-02-01T00:00:00.000Z' }),
    ]
    const once = collapseDuplicateLiveRules(rules)
    const twice = collapseDuplicateLiveRules(once)
    expect(twice).toEqual(once)
  })

  it('collapses duplicates independently per vehicle+item pair, never crossing vehicles or item types', () => {
    const rules = [
      rule({ id: 'v1-it1-old', vehicleId: 'v-1', itemTypeId: 'it-1', createdAt: '2026-01-01T00:00:00.000Z' }),
      rule({ id: 'v1-it1-new', vehicleId: 'v-1', itemTypeId: 'it-1', createdAt: '2026-02-01T00:00:00.000Z' }),
      rule({ id: 'v1-it2', vehicleId: 'v-1', itemTypeId: 'it-2' }),
      rule({ id: 'v2-it1', vehicleId: 'v-2', itemTypeId: 'it-1' }),
    ]

    const result = collapseDuplicateLiveRules(rules)

    const live = result.filter((r) => r.supersededAt === null).map((r) => r.id).sort()
    expect(live).toEqual(['v1-it1-new', 'v1-it2', 'v2-it1'])
  })

  it('handles an empty/undefined list without throwing', () => {
    expect(collapseDuplicateLiveRules([])).toEqual([])
  })
})
