import { describe, it, expect } from 'vitest'
import type { ScheduleRule } from '../../store/scheduleRuleStore'
import { getVehicleDueStatus } from '../vehicleDueSummary'

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

describe('getVehicleDueStatus', () => {
  it('reports no_schedule with zero rules', () => {
    expect(getVehicleDueStatus([], 0)).toEqual({ kind: 'no_schedule' })
  })

  it('is on_track right at base — freshly serviced, nothing driven since', () => {
    const rules = [rule({ intervalKm: 5000, baseOdometer: 209147 })]
    const status = getVehicleDueStatus(rules, 209147)
    expect(status.kind).toBe('scheduled')
    if (status.kind === 'scheduled') expect(status.tone).toBe('on_track')
  })

  it('reads overdue from the km axis alone', () => {
    const rules = [rule({ intervalKm: 5000, baseOdometer: 209147 })]
    const status = getVehicleDueStatus(rules, 214147) // exactly base + interval
    expect(status.kind).toBe('scheduled')
    if (status.kind === 'scheduled') expect(status.tone).toBe('overdue')
  })

  it('stays overdue by a growing margin when no service is recorded — the mark does not ladder forward', () => {
    const rules = [rule({ intervalKm: 5000, baseOdometer: 209147 })]
    const status = getVehicleDueStatus(rules, 219147) // a full interval past the mark, unserviced
    expect(status.kind).toBe('scheduled')
    if (status.kind === 'scheduled') expect(status.tone).toBe('overdue')
  })

  it('stays overdue by a growing margin on the date axis too', () => {
    const rules = [rule({ intervalKm: null, baseOdometer: null, intervalMonths: 4, baseDate: '2026-01-15' })]
    const status = getVehicleDueStatus(rules, 0, new Date(2026, 9, 15)) // 9 months late, no new service
    expect(status.kind).toBe('scheduled')
    if (status.kind === 'scheduled') expect(status.tone).toBe('overdue')
  })

  it('reads overdue from the date axis on a month-only rule', () => {
    const rules = [rule({ intervalKm: null, baseOdometer: null, intervalMonths: 4, baseDate: '2026-01-15' })]
    const status = getVehicleDueStatus(rules, 0, new Date(2026, 4, 15)) // exactly the due date
    expect(status.kind).toBe('scheduled')
    if (status.kind === 'scheduled') expect(status.tone).toBe('overdue')
  })

  it('is overdue when km is on-track but the date axis is overdue — worst axis wins', () => {
    const rules = [
      rule({ intervalKm: 5000, baseOdometer: 0, intervalMonths: 4, baseDate: '2026-01-15' }),
    ]
    // Far from any km mark (on_track), but exactly on the date mark (overdue).
    const status = getVehicleDueStatus(rules, 100, new Date(2026, 4, 15))
    expect(status.kind).toBe('scheduled')
    if (status.kind === 'scheduled') expect(status.tone).toBe('overdue')
  })

  it('is overdue when the date axis is on-track but km is overdue — worst axis wins', () => {
    const rules = [
      rule({ intervalKm: 5000, baseOdometer: 209147, intervalMonths: 4, baseDate: '2026-01-15' }),
    ]
    // Exactly on the km mark (overdue), far from the date mark (on_track).
    const status = getVehicleDueStatus(rules, 214147, new Date(2026, 1, 1))
    expect(status.kind).toBe('scheduled')
    if (status.kind === 'scheduled') expect(status.tone).toBe('overdue')
  })

  it('is on_track when both axes are comfortably ahead', () => {
    const rules = [
      rule({ intervalKm: 5000, baseOdometer: 209147, intervalMonths: 4, baseDate: '2026-01-15' }),
    ]
    const status = getVehicleDueStatus(rules, 205000, new Date(2026, 0, 20))
    expect(status.kind).toBe('scheduled')
    if (status.kind === 'scheduled') expect(status.tone).toBe('on_track')
  })

  it('worst tone across multiple lines still wins', () => {
    const rules = [
      rule({ itemTypeId: 'a', intervalKm: 10000, baseOdometer: 200000 }), // fixed due 210000 — on_track at 205000
      rule({ itemTypeId: 'b', intervalKm: 5000, baseOdometer: 0 }), // fixed due 5000 — badly overdue at 205000, unserviced
    ]
    const status = getVehicleDueStatus(rules, 205000)
    expect(status.kind).toBe('scheduled')
    if (status.kind === 'scheduled') expect(status.tone).toBe('overdue')
  })
})
