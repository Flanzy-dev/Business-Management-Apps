import { describe, it, expect } from 'vitest'
import { getCompletedOrdersForVehicle, serviceTagLabel, lastServicedByItemType } from '../vehicleServiceHistory'
import type { WorkOrder, WorkOrderItem } from '../../store/workOrderStore'
import type { ServiceItemType } from '../../store/serviceItemTypeStore'
import type { ServiceEvent, ServiceEventItem } from '../../store/serviceEventStore'

function order(overrides: Partial<WorkOrder> = {}): WorkOrder {
  return {
    id: 'wo-1',
    orderNumber: 1001,
    vehicleId: 'v1',
    workerId: null,
    driverId: null,
    odometerAtArrival: null,
    odometerAtService: null,
    date: '2026-01-01T00:00:00.000Z',
    items: [],
    subtotal: 0,
    discountAmount: 0,
    taxPercent: 0,
    taxAmount: 0,
    total: 0,
    paymentMethod: 'cash',
    status: 'completed',
    notes: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    completedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function item(overrides: Partial<WorkOrderItem> = {}): WorkOrderItem {
  return {
    id: 'item-1',
    description: 'Oil filter',
    quantity: 1,
    unitPrice: 50000,
    lineTotal: 50000,
    ...overrides,
  }
}

describe('getCompletedOrdersForVehicle', () => {
  it('only includes orders for the given vehicle', () => {
    const orders = [order({ id: 'a', vehicleId: 'v1' }), order({ id: 'b', vehicleId: 'v2' })]
    expect(getCompletedOrdersForVehicle(orders, 'v1').map((o) => o.id)).toEqual(['a'])
  })

  it('excludes non-completed orders', () => {
    const orders = [
      order({ id: 'open', status: 'open' }),
      order({ id: 'cancelled', status: 'cancelled' }),
      order({ id: 'completed', status: 'completed' }),
    ]
    expect(getCompletedOrdersForVehicle(orders, 'v1').map((o) => o.id)).toEqual(['completed'])
  })

  it('sorts newest-first by completedAt', () => {
    const orders = [
      order({ id: 'oldest', completedAt: '2026-01-01T00:00:00.000Z' }),
      order({ id: 'newest', completedAt: '2026-03-01T00:00:00.000Z' }),
      order({ id: 'middle', completedAt: '2026-02-01T00:00:00.000Z' }),
    ]
    expect(getCompletedOrdersForVehicle(orders, 'v1').map((o) => o.id)).toEqual(['newest', 'middle', 'oldest'])
  })

  it('falls back to createdAt when completedAt is missing, for sort purposes', () => {
    const orders = [
      order({ id: 'a', completedAt: null, createdAt: '2026-01-01T00:00:00.000Z' }),
      order({ id: 'b', completedAt: null, createdAt: '2026-02-01T00:00:00.000Z' }),
    ]
    expect(getCompletedOrdersForVehicle(orders, 'v1').map((o) => o.id)).toEqual(['b', 'a'])
  })

  it('is empty for a vehicle with no orders', () => {
    expect(getCompletedOrdersForVehicle([order({ vehicleId: 'other' })], 'v1')).toEqual([])
  })

  describe('taggedOnly', () => {
    it('keeps only orders with at least one service-tagged line when true', () => {
      const orders = [
        order({ id: 'tagged', items: [item({ serviceItemTypeId: 'oil' })] }),
        order({ id: 'untagged', items: [item({ serviceItemTypeId: null })] }),
      ]
      expect(getCompletedOrdersForVehicle(orders, 'v1', { taggedOnly: true }).map((o) => o.id)).toEqual(['tagged'])
    })

    it('includes everything when false or omitted', () => {
      const orders = [
        order({ id: 'tagged', items: [item({ serviceItemTypeId: 'oil' })] }),
        order({ id: 'untagged', items: [item({ serviceItemTypeId: null })] }),
      ]
      const ids = getCompletedOrdersForVehicle(orders, 'v1').map((o) => o.id)
      expect(ids.sort()).toEqual(['tagged', 'untagged'])
    })
  })
})

describe('serviceTagLabel', () => {
  const itemTypeName = (id: string) => (id === 'oil' ? 'Oli Mesin' : 'Unknown')
  const t = (path: string) => (path === 'serviceHistory.toppedUp' ? 'Topped up' : path)

  it('returns null for a line with no service item type', () => {
    expect(serviceTagLabel(item({ serviceItemTypeId: null }), itemTypeName, t)).toBeNull()
  })

  it('returns just the item type name when there are no liters and it was a full change', () => {
    expect(serviceTagLabel(item({ serviceItemTypeId: 'oil', serviceAction: 'changed' }), itemTypeName, t)).toBe('Oli Mesin')
  })

  it('includes liters when present', () => {
    expect(
      serviceTagLabel(item({ serviceItemTypeId: 'oil', quantityLiters: 3.5, serviceAction: 'changed' }), itemTypeName, t)
    ).toBe('Oli Mesin · 3.5L')
  })

  it('includes the topped-up label when the action is topped_up', () => {
    expect(serviceTagLabel(item({ serviceItemTypeId: 'oil', serviceAction: 'topped_up' }), itemTypeName, t)).toBe(
      'Oli Mesin · Topped up'
    )
  })

  it('includes both liters and topped-up together', () => {
    expect(
      serviceTagLabel(item({ serviceItemTypeId: 'oil', quantityLiters: 1, serviceAction: 'topped_up' }), itemTypeName, t)
    ).toBe('Oli Mesin · 1L · Topped up')
  })
})

describe('lastServicedByItemType', () => {
  function itemType(overrides: Partial<ServiceItemType> = {}): ServiceItemType {
    return { id: 'oil', name: 'Oli Mesin', createdAt: '2026-01-01T00:00:00.000Z', ...overrides }
  }

  function eventItem(overrides: Partial<ServiceEventItem> = {}): ServiceEventItem {
    return { id: 'ei-1', itemTypeId: 'oil', action: 'changed', quantityLiters: null, containerType: null, notes: '', ...overrides }
  }

  function event(overrides: Partial<ServiceEvent> = {}): ServiceEvent {
    return {
      id: 'e-1',
      vehicleId: 'v1',
      workOrderId: null,
      date: '2026-01-01T00:00:00.000Z',
      odometerAtArrival: null,
      odometerAtService: 10_000,
      items: [eventItem()],
      notes: '',
      createdAt: '2026-01-01T00:00:00.000Z',
      ...overrides,
    }
  }

  it('drops an item type with no matching event, rather than returning a null date', () => {
    const result = lastServicedByItemType('v1', [itemType()], [])
    expect(result).toEqual([])
  })

  it('picks the most recent event for a type with several', () => {
    const events = [
      event({ id: 'old', date: '2026-01-01T00:00:00.000Z', odometerAtService: 5_000 }),
      event({ id: 'new', date: '2026-03-01T00:00:00.000Z', odometerAtService: 15_000 }),
    ]
    const result = lastServicedByItemType('v1', [itemType()], events)
    expect(result).toEqual([{ itemType: itemType(), date: '2026-03-01T00:00:00.000Z', odometer: 15_000 }])
  })

  it('ignores events for a different vehicle', () => {
    const result = lastServicedByItemType('v1', [itemType()], [event({ vehicleId: 'other' })])
    expect(result).toEqual([])
  })

  it('falls back to odometerAtArrival when odometerAtService is null', () => {
    const result = lastServicedByItemType('v1', [itemType()], [event({ odometerAtService: null, odometerAtArrival: 8_000 })])
    expect(result[0].odometer).toBe(8_000)
  })

  it('only matches events carrying an item for that specific item type', () => {
    const brakeType = itemType({ id: 'brake', name: 'Rem' })
    const events = [event({ items: [eventItem({ itemTypeId: 'oil' })] })]
    expect(lastServicedByItemType('v1', [brakeType], events)).toEqual([])
  })
})
