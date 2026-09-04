import { describe, it, expect } from 'vitest'
import type { Vehicle } from '../../store/vehicleStore'
import type { ScheduleRule } from '../../store/scheduleRuleStore'
import type { ReminderFollowUp } from '../../store/reminderFollowUpStore'
import { getVehicleReminders, getSnoozedVehicleReminders, normalizeWhatsAppPhone, buildReminderMessage } from '../reminders'

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
