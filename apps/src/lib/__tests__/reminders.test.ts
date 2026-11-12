import { describe, it, expect } from 'vitest'
import type { Vehicle } from '../../store/vehicleStore'
import type { ScheduleRule } from '../../store/scheduleRuleStore'
import type { ReminderFollowUp } from '../../store/reminderFollowUpStore'
import {
  getVehicleReminders,
  getSnoozedVehicleReminders,
  getReminderGroups,
  normalizeWhatsAppPhone,
  buildReminderMessage,
} from '../schedule/reminders'

let nextId = 1

function vehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: `veh-${nextId++}`,
    customerId: 'cust-1',
    companyId: null,
    make: 'Toyota',
    model: 'Avanza',
    year: 2020,
    vin: '',
    licensePlate: 'B 1234 XYZ',
    color: '',
    currentMileage: 0,
    engineType: '',
    engineSize: '',
    oilTypeRequired: '',
    oilCapacity: '',
    transmissionType: '',
    transmissionFluidType: '',
    driveType: '',
    differentialFluidType: '',
    notes: '',
    createdAt: new Date(2026, 0, 1).toISOString(),
    ...overrides,
  }
}

function rule(overrides: Partial<ScheduleRule> = {}): ScheduleRule {
  return {
    id: `rule-${nextId++}`,
    vehicleId: 'veh-1',
    itemTypeId: 'oli-mesin',
    intervalKm: 5000,
    baseOdometer: 40000,
    source: 'workshop_default',
    supersededAt: null,
    supersedesId: null,
    notes: '',
    createdAt: new Date(2026, 0, 1).toISOString(),
    ...overrides,
  }
}

function followUp(overrides: Partial<ReminderFollowUp> = {}): ReminderFollowUp {
  return {
    id: 'veh-1',
    vehicleId: 'veh-1',
    contactedAt: null,
    snoozeUntil: null,
    createdAt: new Date(2026, 0, 1).toISOString(),
    ...overrides,
  }
}

describe('getVehicleReminders', () => {
  it('includes an overdue vehicle', () => {
    const v = vehicle({ id: 'veh-1', currentMileage: 46000 })
    const rules = [rule({ vehicleId: 'veh-1', baseOdometer: 40000, intervalKm: 5000 })] // due at 45000
    const reminders = getVehicleReminders([v], rules)
    expect(reminders).toHaveLength(1)
    expect(reminders[0].status.tone).toBe('overdue')
  })

  it('lists only the overdue and due-soon lines in dueLines, not marks still far off', () => {
    const v = vehicle({ id: 'veh-1', currentMileage: 46000 })
    const rules = [
      rule({ vehicleId: 'veh-1', itemTypeId: 'oli-mesin', baseOdometer: 40000, intervalKm: 5000 }), // due 45000: overdue
      rule({ vehicleId: 'veh-1', itemTypeId: 'oli-gardan', baseOdometer: 40000, intervalKm: 100000 }), // due 140000: far off
    ]
    const [reminder] = getVehicleReminders([v], rules)
    expect(reminder.status.lines).toHaveLength(2)
    expect(reminder.dueLines).toHaveLength(1)
    expect(reminder.dueLines[0].itemTypeIds).toEqual(['oli-mesin'])
  })

  it('includes a due-soon vehicle', () => {
    const v = vehicle({ id: 'veh-1', currentMileage: 44700 })
    const rules = [rule({ vehicleId: 'veh-1', baseOdometer: 40000, intervalKm: 5000 })] // due at 45000, within 500km window
    const reminders = getVehicleReminders([v], rules)
    expect(reminders).toHaveLength(1)
    expect(reminders[0].status.tone).toBe('due_soon')
  })

  it('excludes an on-track vehicle', () => {
    const v = vehicle({ id: 'veh-1', currentMileage: 41000 })
    const rules = [rule({ vehicleId: 'veh-1', baseOdometer: 40000, intervalKm: 5000 })]
    expect(getVehicleReminders([v], rules)).toEqual([])
  })

  it('excludes a vehicle with no schedule at all', () => {
    const v = vehicle({ id: 'veh-1', currentMileage: 100000 })
    expect(getVehicleReminders([v], [])).toEqual([])
  })

  it('sorts overdue before due-soon', () => {
    const dueSoon = vehicle({ id: 'veh-1', currentMileage: 44700 })
    const overdue = vehicle({ id: 'veh-2', currentMileage: 46000 })
    const rules = [
      rule({ vehicleId: 'veh-1', baseOdometer: 40000, intervalKm: 5000 }),
      rule({ vehicleId: 'veh-2', baseOdometer: 40000, intervalKm: 5000 }),
    ]
    const reminders = getVehicleReminders([dueSoon, overdue], rules)
    expect(reminders.map((r) => r.vehicle.id)).toEqual(['veh-2', 'veh-1'])
  })

  const now = new Date(2026, 6, 20)

  it('excludes a vehicle whose snooze has not expired yet', () => {
    const v = vehicle({ id: 'veh-1', currentMileage: 46000 })
    const rules = [rule({ vehicleId: 'veh-1', baseOdometer: 40000, intervalKm: 5000 })]
    const followUps = [followUp({ snoozeUntil: '2026-07-25' })]
    expect(getVehicleReminders([v], rules, now, followUps)).toEqual([])
  })

  it('includes a vehicle again once its snooze has expired', () => {
    const v = vehicle({ id: 'veh-1', currentMileage: 46000 })
    const rules = [rule({ vehicleId: 'veh-1', baseOdometer: 40000, intervalKm: 5000 })]
    const followUps = [followUp({ snoozeUntil: '2026-07-01' })]
    const reminders = getVehicleReminders([v], rules, now, followUps)
    expect(reminders).toHaveLength(1)
    expect(reminders[0].followUp?.snoozeUntil).toBe('2026-07-01')
  })

  it('carries a contacted-only (not snoozed) follow-up through without hiding the reminder', () => {
    const v = vehicle({ id: 'veh-1', currentMileage: 46000 })
    const rules = [rule({ vehicleId: 'veh-1', baseOdometer: 40000, intervalKm: 5000 })]
    const followUps = [followUp({ contactedAt: '2026-07-18T10:00:00.000Z' })]
    const reminders = getVehicleReminders([v], rules, now, followUps)
    expect(reminders).toHaveLength(1)
    expect(reminders[0].followUp?.contactedAt).toBe('2026-07-18T10:00:00.000Z')
  })
})

describe('getSnoozedVehicleReminders', () => {
  const now = new Date(2026, 6, 20)

  it('includes a still-due vehicle whose snooze has not expired', () => {
    const v = vehicle({ id: 'veh-1', currentMileage: 46000 })
    const rules = [rule({ vehicleId: 'veh-1', baseOdometer: 40000, intervalKm: 5000 })]
    const followUps = [followUp({ snoozeUntil: '2026-07-25' })]
    const reminders = getSnoozedVehicleReminders([v], rules, now, followUps)
    expect(reminders).toHaveLength(1)
    expect(reminders[0].vehicle.id).toBe('veh-1')
  })

  it('excludes a vehicle with no snooze at all', () => {
    const v = vehicle({ id: 'veh-1', currentMileage: 46000 })
    const rules = [rule({ vehicleId: 'veh-1', baseOdometer: 40000, intervalKm: 5000 })]
    expect(getSnoozedVehicleReminders([v], rules, now, [])).toEqual([])
  })

  it('excludes a vehicle whose snooze has already expired', () => {
    const v = vehicle({ id: 'veh-1', currentMileage: 46000 })
    const rules = [rule({ vehicleId: 'veh-1', baseOdometer: 40000, intervalKm: 5000 })]
    const followUps = [followUp({ snoozeUntil: '2026-07-01' })]
    expect(getSnoozedVehicleReminders([v], rules, now, followUps)).toEqual([])
  })
})

// A car that has simply not come back should still become due by distance.
describe('reminders for a car that has not come back', () => {
  const now = new Date(2026, 9, 28) // Oct 28, 2026
  const reading = (date: string, km: number) => ({ date, km })
  // ~30 km/day, last seen 2026-05-31 at 46.000 — 150 days before `now`.
  const history = new Map([['veh-1', [reading('2026-01-01', 40_000), reading('2026-03-12', 42_100), reading('2026-05-31', 46_000)]]])
  const fallback = { intervalKm: 5000, intervalMonths: 4 }

  describe('with its own schedule', () => {
    // due at 50.000 km — the stored mileage (46.000) is 4.000 short of it.
    const v = () => vehicle({ id: 'veh-1', currentMileage: 46_000 })
    const rules = () => [rule({ vehicleId: 'veh-1', baseOdometer: 40_000, intervalKm: 10_000 })]

    it('is on track as far as the stored mileage knows', () => {
      expect(getVehicleReminders([v()], rules(), now)).toEqual([])
    })

    it('becomes overdue once the estimated mileage passes the mark', () => {
      const [reminder] = getVehicleReminders([v()], rules(), now, [], { readings: history })
      expect(reminder.status.tone).toBe('overdue')
      expect(reminder.basis).toBe('schedule')
      expect(reminder.odometerEstimated).toBe(true)
      expect(reminder.odometer).toBeGreaterThan(50_000)
    })

    it('says plainly when the figure is the recorded one', () => {
      const seenToday = new Map([['veh-1', [reading('2026-01-01', 40_000), reading('2026-10-28', 46_000)]]])
      const reminders = getVehicleReminders([vehicle({ id: 'veh-1', currentMileage: 52_000 })], rules(), now, [], { readings: seenToday })
      expect(reminders[0].odometerEstimated).toBe(false)
      expect(reminders[0].odometer).toBe(52_000)
    })
  })

  describe('with no schedule of its own', () => {
    const v = () => vehicle({ id: 'veh-1', currentMileage: 46_000 })

    it('is not reminded about unless a default interval is supplied', () => {
      expect(getVehicleReminders([v()], [], now, [], { readings: history })).toEqual([])
    })

    it('falls back to the shop default interval from its last visit', () => {
      const [reminder] = getVehicleReminders([v()], [], now, [], { readings: history, fallback })
      expect(reminder.basis).toBe('default')
      // 5.000 km after the last visit's 46.000, and 4 months after 2026-05-31
      expect(reminder.status.lines[0]).toMatchObject({ dueKm: 51_000, dueDate: '2026-09-30' })
      expect(reminder.status.tone).toBe('overdue')
    })

    it('names no service — nobody knows what was done last time', () => {
      const [reminder] = getVehicleReminders([v()], [], now, [], { readings: history, fallback })
      expect(reminder.dueLines.every((line) => line.itemTypeIds.length === 0)).toBe(true)
    })

    it('is due by date alone when the rate is unknown', () => {
      const oneVisit = new Map([['veh-1', [reading('2026-05-31', 46_000)]]])
      const [reminder] = getVehicleReminders([v()], [], now, [], { readings: oneVisit, fallback })
      expect(reminder.odometerEstimated).toBe(false)
      expect(reminder.status.tone).toBe('overdue')
    })

    it('is quiet for a car seen recently enough to be on track', () => {
      const recent = new Map([['veh-1', [reading('2026-10-01', 46_000)]]])
      expect(getVehicleReminders([v()], [], now, [], { readings: recent, fallback })).toEqual([])
    })

    it('lets a customer who left more than a year ago go, rather than nag forever', () => {
      const lapsed = new Map([['veh-1', [reading('2025-08-01', 41_000)]]])
      expect(getVehicleReminders([v()], [], now, [], { readings: lapsed, fallback })).toEqual([])
    })

    it('still reminds a car on the last day inside the window', () => {
      const edge = new Map([['veh-1', [reading('2025-10-28', 41_000)]]])
      expect(getVehicleReminders([v()], [], now, [], { readings: edge, fallback })).toHaveLength(1)
    })

    it('has nothing to go on for a car that never had a recorded visit', () => {
      expect(getVehicleReminders([v()], [], now, [], { readings: new Map(), fallback })).toEqual([])
    })

    it('honours a snooze like any other reminder', () => {
      const snoozed = [followUp({ snoozeUntil: '2026-11-15' })]
      expect(getVehicleReminders([v()], [], now, snoozed, { readings: history, fallback })).toEqual([])
      expect(getSnoozedVehicleReminders([v()], [], now, snoozed, { readings: history, fallback })).toHaveLength(1)
    })

    it('never overrides a car that does have its own schedule', () => {
      const own = [rule({ vehicleId: 'veh-1', baseOdometer: 45_000, intervalKm: 20_000 })] // far off
      expect(getVehicleReminders([v()], own, now, [], { readings: history, fallback })).toEqual([])
    })
  })

  it('groups the default-basis cars with the rest', () => {
    const v = vehicle({ id: 'veh-1', currentMileage: 46_000 })
    const groups = getReminderGroups([v], [], now, [], { readings: history, fallback })
    expect(groups.overdue.map((r) => r.vehicle.id)).toEqual(['veh-1'])
  })
})

describe('getReminderGroups', () => {
  const now = new Date(2026, 6, 20)
  // veh-1 overdue, veh-2 due soon, veh-3 overdue but snoozed, veh-4 on track
  const vehicles = [
    vehicle({ id: 'veh-1', currentMileage: 46000 }),
    vehicle({ id: 'veh-2', currentMileage: 44700 }),
    vehicle({ id: 'veh-3', currentMileage: 46000 }),
    vehicle({ id: 'veh-4', currentMileage: 41000 }),
  ]
  const rules = vehicles.map((v) => rule({ vehicleId: v.id, baseOdometer: 40000, intervalKm: 5000 }))
  const followUps = [followUp({ id: 'veh-3', vehicleId: 'veh-3', snoozeUntil: '2026-07-25' })]

  it('splits overdue, due-soon and snoozed in one pass', () => {
    const groups = getReminderGroups(vehicles, rules, now, followUps)
    expect(groups.overdue.map((r) => r.vehicle.id)).toEqual(['veh-1'])
    expect(groups.dueSoon.map((r) => r.vehicle.id)).toEqual(['veh-2'])
    expect(groups.snoozed.map((r) => r.vehicle.id)).toEqual(['veh-3'])
  })

  it('matches the two single-purpose functions it replaces on the page', () => {
    const groups = getReminderGroups(vehicles, rules, now, followUps)
    expect([...groups.overdue, ...groups.dueSoon]).toEqual(getVehicleReminders(vehicles, rules, now, followUps))
    expect(groups.snoozed).toEqual(getSnoozedVehicleReminders(vehicles, rules, now, followUps))
  })

  it('returns three empty lists when nothing is due', () => {
    expect(getReminderGroups([vehicle({ id: 'veh-9', currentMileage: 41000 })], [], now, [])).toEqual({
      overdue: [],
      dueSoon: [],
      snoozed: [],
    })
  })
})

describe('normalizeWhatsAppPhone', () => {
  it('converts a leading 0 to 62', () => {
    expect(normalizeWhatsAppPhone('0812345678')).toBe('62812345678')
  })

  it('leaves an already-62-prefixed number alone', () => {
    expect(normalizeWhatsAppPhone('62812345678')).toBe('62812345678')
  })

  it('strips dashes, spaces, and a leading +', () => {
    expect(normalizeWhatsAppPhone('+62 812-345-678')).toBe('62812345678')
  })
})

describe('buildReminderMessage', () => {
  it('interpolates owner, vehicle, and due description through the passed t()', () => {
    const t = (key: string, vars?: Record<string, string | number>) =>
      `${key}:${vars?.owner}:${vars?.vehicle}:${vars?.due}`
    expect(buildReminderMessage(t, 'Budi', 'Toyota Avanza (B 1234 XYZ)', '45,000 km — Ganti Oli Mesin')).toBe(
      'reminders.messageTemplate:Budi:Toyota Avanza (B 1234 XYZ):45,000 km — Ganti Oli Mesin'
    )
  })
})
