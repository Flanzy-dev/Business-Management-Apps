import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  VEHICLE_REFERENCE_STORES,
  vehicleReferenceCounts,
  chooseSurvivor,
  planVehicleMerge,
  type VehicleWorld,
} from '../vehicles/vehicleReferences'
import { vehicle, order, rule, serviceEvent, appointment, followUp } from './helpers/vehicleFixtures'

const EMPTY: VehicleWorld = { workOrders: [], scheduleRules: [], serviceEvents: [], appointments: [], followUps: [] }

describe('every store that holds a vehicleId is known here', () => {
  // The guard that keeps a future store from becoming a silent orphan source:
  // anything declaring a `vehicleId` field must be in VEHICLE_REFERENCE_STORES,
  // or deletes will leave it dangling and merges will leave it behind.
  it('matches the stores on disk', () => {
    const dir = join(__dirname, '..', '..', 'store')
    const holding = readdirSync(dir)
      .filter((f) => f.endsWith('Store.ts') && f !== 'vehicleStore.ts')
      .filter((f) => /^\s+vehicleId\s*:/m.test(readFileSync(join(dir, f), 'utf8')))
      .map((f) => f.replace(/\.ts$/, ''))
      .sort()
    expect(holding).toEqual([...VEHICLE_REFERENCE_STORES].sort())
  })
})

describe('vehicleReferenceCounts', () => {
  it('counts every kind of reference, live rules once per item type', () => {
    const counts = vehicleReferenceCounts('v-1', {
      workOrders: [order(), order({ id: 'wo-2', vehicleId: 'v-2' })],
      scheduleRules: [
        rule({ id: 'r-1' }),
        rule({ id: 'r-2' }), // a sync duplicate of the same item type
        rule({ id: 'r-3', supersededAt: '2025-01-01T00:00:00.000Z' }),
      ],
      serviceEvents: [serviceEvent()],
      appointments: [appointment()],
      followUps: [followUp()],
    })
    expect(counts).toEqual({ orders: 1, activeRules: 1, serviceEvents: 1, appointments: 1, followUp: true })
  })

  it('treats a part of the world it was not given as empty', () => {
    expect(vehicleReferenceCounts('v-1', {})).toEqual({
      orders: 0, activeRules: 0, serviceEvents: 0, appointments: 0, followUp: false,
    })
  })
})

describe('chooseSurvivor', () => {
  it('keeps the vehicle the car was last brought in on', () => {
    const a = vehicle({ id: 'a' })
    const b = vehicle({ id: 'b' })
    const survivor = chooseSurvivor([a, b], [
      order({ id: '1', vehicleId: 'a', date: '2025-09-01T05:00:00.000Z' }),
      order({ id: '2', vehicleId: 'b', date: '2024-06-29T05:00:00.000Z' }),
    ])
    expect(survivor.id).toBe('a')
  })

  it('falls back to the newer vehicle when neither has orders', () => {
    const old = vehicle({ id: 'old', createdAt: '2026-09-01T00:00:00.000Z' })
    const recent = vehicle({ id: 'new', createdAt: '2026-10-06T00:00:00.000Z' })
    expect(chooseSurvivor([old, recent], []).id).toBe('new')
  })
})

describe('planVehicleMerge', () => {
  const survivor = vehicle({ id: 's', customerId: 'c-armada', make: '', currentMileage: 150_000, notes: '' })
  const loser = vehicle({ id: 'l', customerId: 'c-kobra', make: 'Fuso', year: 2015, currentMileage: 174_580 })

  it('keeps the more recently serviced live rule and supersedes the other', () => {
    const plan = planVehicleMerge(survivor, [loser], {
      ...EMPTY,
      scheduleRules: [
        rule({ id: 'old', vehicleId: 's', itemTypeId: 'oil', baseDate: '2024-01-01' }),
        rule({ id: 'new', vehicleId: 'l', itemTypeId: 'oil', baseDate: '2025-06-01' }),
        rule({ id: 'gardan', vehicleId: 'l', itemTypeId: 'gardan' }),
      ],
    })
    expect(plan.supersedeRuleIds).toEqual(['old'])
    expect(plan.moved.scheduleRules).toBe(2)
  })

  it('breaks a same-date tie on the higher odometer', () => {
    const plan = planVehicleMerge(survivor, [loser], {
      ...EMPTY,
      scheduleRules: [
        rule({ id: 'far', vehicleId: 's', baseOdometer: 200_000 }),
        rule({ id: 'near', vehicleId: 'l', baseOdometer: 120_000 }),
      ],
    })
    expect(plan.supersedeRuleIds).toEqual(['near'])
  })

  it("keeps the survivor's own follow-up, else the loser's re-keyed to the survivor", () => {
    const own = planVehicleMerge(survivor, [loser], {
      ...EMPTY,
      followUps: [followUp({ vehicleId: 's', snoozeUntil: '2026-12-01' }), followUp({ vehicleId: 'l' })],
    })
    expect(own.followUp).toMatchObject({ id: 's', vehicleId: 's', snoozeUntil: '2026-12-01' })

    const inherited = planVehicleMerge(survivor, [loser], { ...EMPTY, followUps: [followUp({ vehicleId: 'l' })] })
    expect(inherited.followUp).toMatchObject({ id: 's', vehicleId: 's' })

    expect(planVehicleMerge(survivor, [loser], EMPTY).followUp).toBeNull()
  })

  it('fills the survivor card from the loser without overwriting what it has', () => {
    const plan = planVehicleMerge({ ...survivor, model: 'Canter' }, [{ ...loser, model: 'Other' }], EMPTY)
    expect(plan.survivorPatch).toMatchObject({ make: 'Fuso', year: 2015, currentMileage: 174_580 })
    expect(plan.survivorPatch.model).toBeUndefined()
    expect(plan.survivorPatch.notes).toMatch(/Digabung dari 1 kendaraan/)
  })

  it('counts what moves', () => {
    const plan = planVehicleMerge(survivor, [loser], {
      ...EMPTY,
      workOrders: [order({ id: '1', vehicleId: 'l' }), order({ id: '2', vehicleId: 's' })],
      serviceEvents: [serviceEvent({ vehicleId: 'l' })],
      appointments: [appointment({ vehicleId: 'l' }), appointment({ id: 'a-2', vehicleId: null })],
    })
    expect(plan.moved).toEqual({ orders: 1, serviceEvents: 1, appointments: 1, scheduleRules: 0 })
  })
})
