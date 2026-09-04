import { describe, it, expect } from 'vitest'
import { bayHoldingOrder, nextAvailableBay, estimatedEnd } from '../bayAssignment'
import type { Bay } from '../../store/bayStore'

let nextId = 1
function bay(overrides: Partial<Bay> = {}): Bay {
  return {
    id: `bay-${nextId++}`,
    name: 'Bay',
    status: 'available',
    currentWorkOrderId: null,
    assignedWorkerId: null,
    estimatedEndTime: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('bayHoldingOrder', () => {
  it('finds the one bay holding this order', () => {
    const target = bay({ id: 'b-2', currentWorkOrderId: 'wo-1' })
    const bays = [bay({ id: 'b-1', currentWorkOrderId: null }), target]
    expect(bayHoldingOrder(bays, 'wo-1')).toBe(target)
  })

  it('returns undefined when no bay holds this order', () => {
    expect(bayHoldingOrder([bay({ currentWorkOrderId: 'wo-other' })], 'wo-1')).toBeUndefined()
  })
})

describe('nextAvailableBay', () => {
  it('returns the first available bay', () => {
    const inService = bay({ status: 'in-service' })
    const available = bay({ status: 'available' })
    expect(nextAvailableBay([inService, available])).toBe(available)
  })

  it('returns undefined when every bay is occupied', () => {
    expect(nextAvailableBay([bay({ status: 'in-service' }), bay({ status: 'inspection' })])).toBeUndefined()
  })
})

describe('estimatedEnd', () => {
  it('adds the given minutes to now', () => {
    const now = new Date('2026-01-01T00:00:00.000Z')
    expect(estimatedEnd(now, 45)).toBe('2026-01-01T00:45:00.000Z')
  })
})
