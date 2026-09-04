import { describe, it, expect } from 'vitest'
import type { ScheduleRule } from '../../store/scheduleRuleStore'
import {
  nextDueKm,
  nextDueDate,
  isValidScheduleMark,
  groupDueLines,
  dueLineTone,
  dueDateTone,
  activeRulesForVehicle,
  formatDueLine,
} from '../scheduleEngine'

let nextId = 1

function rule(overrides: Partial<ScheduleRule> = {}): ScheduleRule {
  return {
    id: `rule-${nextId++}`,
    vehicleId: 'v-1',
    itemTypeId: 'oli-mesin',
    intervalKm: 5000,
    baseOdometer: 209147,
    source: 'workshop_default',
    supersededAt: null,
    supersedesId: null,
    notes: '',
    createdAt: new Date(2026, 0, 1).toISOString(),
    ...overrides,
  }
}

describe('nextDueKm', () => {
  it('is a fixed target one interval past base', () => {
    expect(nextDueKm(209147, 5000)).toBe(214147)
    expect(nextDueKm(0, 5000)).toBe(5000)
  })

  it('never moves — the same base+interval always yields the same mark, regardless of how far the odometer drifts past it', () => {
    // Nothing here reads "current" at all — that's the point. A vehicle that
    // never comes back for service keeps the same fixed mark, so its overdue
    // amount (computed elsewhere, against currentOdometer) keeps growing
    // instead of the mark silently re-aiming at some future rung.
    expect(nextDueKm(209147, 5000)).toBe(214147)
  })
})

describe('isValidScheduleMark', () => {
  it('accepts exact multiples of the interval above base', () => {
    expect(isValidScheduleMark(209147, 5000, 209147)).toBe(true)
    expect(isValidScheduleMark(209147, 5000, 214147)).toBe(true)
    expect(isValidScheduleMark(209147, 5000, 224147)).toBe(true)
  })

  it('rejects values that are not on the ladder', () => {
    expect(isValidScheduleMark(209147, 5000, 218403)).toBe(false) // 9,256 from base
    expect(isValidScheduleMark(209147, 5000, 211578)).toBe(false)
    expect(isValidScheduleMark(209147, 5000, 209000)).toBe(false) // before base
  })

  it('rejects a non-positive interval', () => {
    expect(isValidScheduleMark(209147, 0, 209147)).toBe(false)
  })
})

describe('activeRulesForVehicle', () => {
  it('returns only this vehicle\'s live (non-superseded) rules', () => {
    const rules = [
      rule({ vehicleId: 'v-1', supersededAt: null }),
      rule({ vehicleId: 'v-1', supersededAt: new Date().toISOString() }),
      rule({ vehicleId: 'v-2', supersededAt: null }),
    ]
    const active = activeRulesForVehicle(rules, 'v-1')
    expect(active).toHaveLength(1)
    expect(active[0].vehicleId).toBe('v-1')
    expect(active[0].supersededAt).toBeNull()
  })

  it('returns an empty array for a vehicle with no rules at all', () => {
    expect(activeRulesForVehicle([rule({ vehicleId: 'v-1' })], 'v-2')).toEqual([])
  })

  // Sync's per-row merge has no notion of "one live rule per vehicle+item
  // type" (see scheduleRuleStore.ts's interface doc comment) — two devices
  // independently superseding the same rule while offline from each other
  // can each insert their own live replacement, leaving two live rules for
  // one item type. Every reader has to collapse that the same way, or the
  // duplicate shows as two rows in one place and one row somewhere else.
  it('collapses two live rules for the same item type down to the newest one', () => {
    const older = rule({ itemTypeId: 'oli-mesin', createdAt: new Date(2026, 0, 1).toISOString() })
    const newer = rule({ itemTypeId: 'oli-mesin', createdAt: new Date(2026, 0, 2).toISOString() })
    const other = rule({ itemTypeId: 'filter-oli' })

    const active = activeRulesForVehicle([older, newer, other], 'v-1')

    expect(active).toHaveLength(2)
    expect(active.find((r) => r.itemTypeId === 'oli-mesin')?.id).toBe(newer.id)
    expect(active.find((r) => r.itemTypeId === 'filter-oli')?.id).toBe(other.id)
  })

  it('picks the same winner regardless of input array order — the cross-device determinism guarantee', () => {
    const older = rule({ itemTypeId: 'oli-mesin', createdAt: new Date(2026, 0, 1).toISOString() })
    const newer = rule({ itemTypeId: 'oli-mesin', createdAt: new Date(2026, 0, 2).toISOString() })

    const forward = activeRulesForVehicle([older, newer], 'v-1')
    const reversed = activeRulesForVehicle([newer, older], 'v-1')

    expect(forward[0].id).toBe(newer.id)
    expect(reversed[0].id).toBe(newer.id)
  })
})

describe('formatDueLine', () => {
  const itemTypeName = (id: string) => (id === 'oli-mesin' ? 'Engine Oil' : 'Unknown')

  it('joins km and date with " / " for a line tracking both axes', () => {
    const { when, what } = formatDueLine(
      { dueKm: 214147, dueDate: '2026-05-15', itemTypeIds: ['oli-mesin'] },
      itemTypeName
    )
    expect(when).toBe('214,147 km / May 15, 2026')
    expect(what).toBe('Engine Oil')
  })

  it('omits the missing axis rather than leaving a stray separator', () => {
    const { when } = formatDueLine({ dueKm: 214147, dueDate: null, itemTypeIds: ['oli-mesin'] }, itemTypeName)
    expect(when).toBe('214,147 km')
  })

  it('joins multiple item types with ", "', () => {
    const { what } = formatDueLine(
      { dueKm: 214147, dueDate: null, itemTypeIds: ['oli-mesin', 'oli-mesin'] },
      itemTypeName
    )
    expect(what).toBe('Engine Oil, Engine Oil')
  })
})

describe('groupDueLines', () => {
  it('collapses a genuine coincidence — same base and interval — into one line', () => {
    const rules = [
      rule({ itemTypeId: 'filter-oli', intervalKm: 15000, baseOdometer: 209147 }),
      rule({ itemTypeId: 'oli-transmisi', intervalKm: 15000, baseOdometer: 209147 }),
    ]
    const lines = groupDueLines(rules)
    expect(lines).toHaveLength(1)
    expect(lines[0].dueKm).toBe(224147)
    expect(lines[0].itemTypeIds.sort()).toEqual(['filter-oli', 'oli-transmisi'].sort())
  })

  it('keeps items with different fixed marks on separate lines, sorted by due km', () => {
    const rules = [
      rule({ itemTypeId: 'oli-mesin', intervalKm: 5000, baseOdometer: 209147 }),
      rule({ itemTypeId: 'filter-oli', intervalKm: 15000, baseOdometer: 209147 }),
    ]
    const lines = groupDueLines(rules)
    expect(lines).toEqual([
      { dueKm: 214147, dueDate: null, itemTypeIds: ['oli-mesin'] },
      { dueKm: 224147, dueDate: null, itemTypeIds: ['filter-oli'] },
    ])
  })

  it('ignores superseded rules', () => {
    const rules = [rule({ supersededAt: new Date().toISOString() })]
    expect(groupDueLines(rules)).toEqual([])
  })

  it('computes a month-only rule\'s dueDate with no km at all', () => {
    const rules = [
      rule({ itemTypeId: 'inveten', intervalKm: null, baseOdometer: null, intervalMonths: 4, baseDate: '2026-01-15' }),
    ]
    const lines = groupDueLines(rules)
    expect(lines).toEqual([{ dueKm: null, dueDate: '2026-05-15', itemTypeIds: ['inveten'] }])
  })

  it('carries both axes on a rule that tracks km and months', () => {
    const rules = [
      rule({ itemTypeId: 'oli-mesin', intervalKm: 5000, baseOdometer: 209147, intervalMonths: 4, baseDate: '2026-01-15' }),
    ]
    const lines = groupDueLines(rules)
    expect(lines).toEqual([{ dueKm: 214147, dueDate: '2026-05-15', itemTypeIds: ['oli-mesin'] }])
  })
})

describe('nextDueDate', () => {
  it('is a fixed target one interval past base', () => {
    expect(nextDueDate('2026-01-15', 4)).toBe('2026-05-15')
  })

  it('handles a 24-month interval crossing multiple years', () => {
    expect(nextDueDate('2024-06-10', 24)).toBe('2026-06-10')
  })

  it('never moves — the same base+interval always yields the same date, regardless of how late the check-in is', () => {
    expect(nextDueDate('2026-01-15', 4)).toBe('2026-05-15')
  })
})

describe('dueDateTone', () => {
  it('classifies overdue, due-soon, and on-track by days remaining', () => {
    expect(dueDateTone('2026-05-15', new Date(2026, 4, 20))).toBe('overdue')
    expect(dueDateTone('2026-05-15', new Date(2026, 4, 15))).toBe('overdue') // exact day counts as due now
    expect(dueDateTone('2026-05-15', new Date(2026, 4, 5))).toBe('due_soon') // 10 days out, window 14
    expect(dueDateTone('2026-05-15', new Date(2026, 3, 1))).toBe('on_track')
  })

  it('stays overdue by a growing margin — a fixed mark does not reset once passed', () => {
    expect(dueDateTone('2026-05-15', new Date(2026, 5, 15))).toBe('overdue') // 1 month late
    expect(dueDateTone('2026-05-15', new Date(2026, 10, 15))).toBe('overdue') // 6 months late
  })

  it('gives the same tone regardless of time of day — a due-tomorrow car reads due_soon whether "now" is 00:01 or 23:59', () => {
    const dueTomorrow = '2026-05-15'
    expect(dueDateTone(dueTomorrow, new Date(2026, 4, 14, 0, 1))).toBe('due_soon')
    expect(dueDateTone(dueTomorrow, new Date(2026, 4, 14, 23, 59))).toBe('due_soon')
  })

  it('gives the same overdue tone at any time of day for a mark already passed', () => {
    const dueYesterday = '2026-05-14'
    expect(dueDateTone(dueYesterday, new Date(2026, 4, 15, 0, 1))).toBe('overdue')
    expect(dueDateTone(dueYesterday, new Date(2026, 4, 15, 23, 59))).toBe('overdue')
  })
})

describe('dueLineTone', () => {
  it('classifies overdue, due-soon, and on-track', () => {
    expect(dueLineTone(214147, 214200)).toBe('overdue')
    expect(dueLineTone(214147, 214147)).toBe('overdue') // exact mark counts as due now
    expect(dueLineTone(214147, 213700)).toBe('due_soon')
    expect(dueLineTone(214147, 210000)).toBe('on_track')
  })

  it('stays overdue by a growing margin — a fixed mark does not reset once passed', () => {
    expect(dueLineTone(214147, 215000)).toBe('overdue') // 853 km late
    expect(dueLineTone(214147, 224147)).toBe('overdue') // a full interval late, no service recorded
  })
})
