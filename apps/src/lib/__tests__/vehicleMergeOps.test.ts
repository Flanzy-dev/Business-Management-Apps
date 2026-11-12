// The store half of a vehicle merge: vehicleReferences.test.ts proves the
// plan; this proves applying it moves every reference, deletes only the
// losers, and never deletes a schedule rule.
import { describe, it, expect } from 'vitest'
import { createVehicleMergeOps } from '../ops/vehicleMergeOps'
import { buildFakeOpsDeps } from './helpers/fakeOpsDeps'
import { vehicle, order, rule, serviceEvent, appointment, followUp } from './helpers/vehicleFixtures'

function shopWithDuplicate() {
  return buildFakeOpsDeps({
    customers: [{ id: 'c-armada' }, { id: 'c-kobra' }],
    vehicles: [
      vehicle({ id: 'armada', customerId: 'c-armada', licensePlate: 'H 9188 EA' }),
      vehicle({ id: 'kobra', customerId: 'c-kobra', licensePlate: 'h9188ea', make: 'Fuso' }),
      vehicle({ id: 'other', customerId: 'c-armada', licensePlate: 'H 1 AA' }),
    ],
    workOrders: [
      order({ id: 'o-new', vehicleId: 'armada', date: '2025-09-01T05:00:00.000Z' }),
      order({ id: 'o-old', vehicleId: 'kobra', date: '2024-06-29T05:00:00.000Z' }),
    ],
    scheduleRules: [
      rule({ id: 'r-armada', vehicleId: 'armada', baseDate: '2025-09-01' }),
      rule({ id: 'r-kobra', vehicleId: 'kobra', baseDate: '2024-06-29' }),
    ],
    serviceEvents: [serviceEvent({ vehicleId: 'kobra' })],
    appointments: [appointment({ vehicleId: 'kobra' })],
    reminderFollowUps: [followUp({ vehicleId: 'kobra' })],
  })
}

describe('mergeAllDuplicatePlates', () => {
  it('moves every reference onto the vehicle of the latest visit and removes the copy', () => {
    const world = shopWithDuplicate()
    const outcome = createVehicleMergeOps(world.deps).mergeAllDuplicatePlates()

    expect(outcome).toEqual({ groups: 1, vehiclesRemoved: 1 })
    expect(world.vehicles.vehicles.map((v) => v.id)).toEqual(['armada', 'other'])
    expect(world.workOrders.workOrders.every((o) => o.vehicleId === 'armada')).toBe(true)
    expect(world.serviceEvents.serviceEvents[0].vehicleId).toBe('armada')
    expect(world.appointments.appointments[0].vehicleId).toBe('armada')
    expect(world.reminderFollowUps.followUps).toMatchObject([{ id: 'armada', vehicleId: 'armada' }])
  })

  it('supersedes the losing schedule rule instead of deleting it', () => {
    const world = shopWithDuplicate()
    createVehicleMergeOps(world.deps).mergeAllDuplicatePlates()

    const rules = world.scheduleRules.scheduleRules
    expect(rules).toHaveLength(2)
    expect(rules.every((r) => r.vehicleId === 'armada')).toBe(true)
    expect(rules.find((r) => r.id === 'r-armada')?.supersededAt).toBeNull()
    expect(rules.find((r) => r.id === 'r-kobra')?.supersededAt).not.toBeNull()
  })

  it('fills blanks on the survivor and logs one entry', () => {
    const world = shopWithDuplicate()
    createVehicleMergeOps(world.deps).mergeAllDuplicatePlates()

    expect(world.vehicles.vehicles[0].make).toBe('Fuso')
    expect(world.activityLog.entries).toHaveLength(1)
    expect(world.activityLog.entries[0]).toMatchObject({ action: 'update', entityType: 'vehicle', entityId: 'armada' })
  })

  it('does nothing when there are no duplicates', () => {
    const world = buildFakeOpsDeps({ vehicles: [vehicle()] })
    expect(createVehicleMergeOps(world.deps).mergeAllDuplicatePlates()).toEqual({ groups: 0, vehiclesRemoved: 0 })
    expect(world.vehicles.vehicles).toHaveLength(1)
  })
})

describe('mergeVehicles', () => {
  it('returns null and changes nothing when a side is missing', () => {
    const world = shopWithDuplicate()
    expect(createVehicleMergeOps(world.deps).mergeVehicles('armada', ['gone'])).toBeNull()
    expect(world.vehicles.vehicles).toHaveLength(3)
  })
})
