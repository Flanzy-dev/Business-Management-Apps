import { describe, it, expect } from 'vitest'
import { plateKey, formatPlate, plateMatches, findVehicleByPlate, duplicatePlateGroups } from '../vehicles/vehicleIdentity'
import { vehicle } from './helpers/vehicleFixtures'

describe('plateKey', () => {
  it('treats spacing, case and punctuation as the same plate', () => {
    expect(plateKey('H 4321 AB')).toBe('H4321AB')
    expect(plateKey('h4321ab')).toBe('H4321AB')
    expect(plateKey(' H-4321-AB ')).toBe('H4321AB')
  })

  it('gives an empty key for no plate', () => {
    expect(plateKey('')).toBe('')
    expect(plateKey(null)).toBe('')
    expect(plateKey('  ')).toBe('')
  })
})

describe('formatPlate', () => {
  it('stores uppercase with single spaces', () => {
    expect(formatPlate('  h  4321   ab ')).toBe('H 4321 AB')
  })
})

describe('plateMatches', () => {
  it('finds a plate regardless of the spaces the user typed', () => {
    expect(plateMatches('H 4321 AB', 'h4321')).toBe(true)
    expect(plateMatches('H 4321 AB', '4321 a')).toBe(true)
    expect(plateMatches('H 4321 AB', '4322')).toBe(false)
  })

  it('never matches an empty query', () => {
    expect(plateMatches('H 4321 AB', ' ')).toBe(false)
  })
})

describe('findVehicleByPlate', () => {
  const vehicles = [vehicle({ id: 'v-1', licensePlate: 'H 4321 AB' }), vehicle({ id: 'v-2', licensePlate: '' })]

  it('finds the vehicle already carrying a plate', () => {
    expect(findVehicleByPlate(vehicles, 'h4321ab')?.id).toBe('v-1')
  })

  it('ignores the vehicle being edited, which may keep its own plate', () => {
    expect(findVehicleByPlate(vehicles, 'H 4321 AB', 'v-1')).toBeUndefined()
  })

  it('never calls a blank plate a duplicate', () => {
    expect(findVehicleByPlate(vehicles, '')).toBeUndefined()
  })
})

describe('duplicatePlateGroups', () => {
  it('groups vehicles sharing a plate, and only those', () => {
    const groups = duplicatePlateGroups([
      vehicle({ id: 'a', licensePlate: 'H 2 BB' }),
      vehicle({ id: 'b', licensePlate: 'H 1 AA' }),
      vehicle({ id: 'c', licensePlate: 'h2bb' }),
      vehicle({ id: 'd', licensePlate: '' }),
      vehicle({ id: 'e', licensePlate: '' }),
    ])
    expect(groups.map((g) => g.map((v) => v.id))).toEqual([['a', 'c']])
  })
})
