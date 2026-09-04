import { describe, it, expect } from 'vitest'
import { filterWorkOrderList, workOrderTabCounts, type WorkOrderSearchFields } from '../workOrderListFilter'
import type { WorkOrder } from '../../store/workOrderStore'

let nextId = 1
function order(overrides: Partial<WorkOrder> = {}): WorkOrder {
  return {
    id: `wo-${nextId}`,
    orderNumber: 1000 + nextId++,
    vehicleId: 'v-1',
    workerId: null,
    driverId: null,
    odometerAtArrival: null,
    odometerAtService: null,
    date: '2026-06-15',
    items: [],
    subtotal: 0,
    discountAmount: 0,
    taxPercent: 0,
    taxAmount: 0,
    total: 100_000,
    paymentMethod: 'cash',
    status: 'open',
    notes: '',
    createdAt: new Date(2026, 5, 15, 9, 0).toISOString(),
    completedAt: null,
    ...overrides,
  } as WorkOrder
}

const blankFields: WorkOrderSearchFields = { ownerName: '', vehicleDisplay: '', vehiclePlate: '', workerName: '' }

describe('filterWorkOrderList', () => {
  it('"all" keeps every order', () => {
    const orders = [order({ status: 'open' }), order({ status: 'completed', paymentMethod: 'cash' })]
    expect(filterWorkOrderList(orders, 'all', '', () => blankFields)).toHaveLength(2)
  })

  it('"open" keeps only open orders', () => {
    const open = order({ status: 'open' })
    const completed = order({ status: 'completed', paymentMethod: 'cash' })
    expect(filterWorkOrderList([open, completed], 'open', '', () => blankFields).map(o => o.id)).toEqual([open.id])
  })

  it('"pending" keeps only completed-but-unpaid orders', () => {
    const pending = order({ status: 'completed', paymentMethod: 'pending' })
    const paid = order({ status: 'completed', paymentMethod: 'cash' })
    expect(filterWorkOrderList([pending, paid], 'pending', '', () => blankFields).map(o => o.id)).toEqual([pending.id])
  })

  it('"completed" excludes a completed-but-unpaid order', () => {
    const pending = order({ status: 'completed', paymentMethod: 'pending' })
    const paid = order({ status: 'completed', paymentMethod: 'cash' })
    expect(filterWorkOrderList([pending, paid], 'completed', '', () => blankFields).map(o => o.id)).toEqual([paid.id])
  })

  it('matches by bare order number or "sb-" prefixed', () => {
    const wo = order({ orderNumber: 1234 })
    expect(filterWorkOrderList([wo], 'all', '1234', () => blankFields)).toHaveLength(1)
    expect(filterWorkOrderList([wo], 'all', 'sb-1234', () => blankFields)).toHaveLength(1)
  })

  it('matches case-insensitively against the resolved search fields', () => {
    const wo = order()
    const fields: WorkOrderSearchFields = { ownerName: 'Budi Santoso', vehicleDisplay: '', vehiclePlate: '', workerName: '' }
    expect(filterWorkOrderList([wo], 'all', 'BUDI', () => fields)).toHaveLength(1)
  })

  it('excludes an order matching neither the number nor any search field', () => {
    const wo = order({ orderNumber: 1234 })
    expect(filterWorkOrderList([wo], 'all', 'nomatch', () => blankFields)).toEqual([])
  })

  it('sorts newest-first by createdAt', () => {
    const older = order({ createdAt: new Date(2026, 0, 1).toISOString() })
    const newer = order({ createdAt: new Date(2026, 5, 1).toISOString() })
    expect(filterWorkOrderList([older, newer], 'all', '', () => blankFields).map(o => o.id)).toEqual([newer.id, older.id])
  })
})

describe('workOrderTabCounts', () => {
  it('splits open/pending/completed the same way the tab filter does', () => {
    const open = order({ status: 'open' })
    const pending = order({ status: 'completed', paymentMethod: 'pending' })
    const paid = order({ status: 'completed', paymentMethod: 'cash' })
    expect(workOrderTabCounts([open, pending, paid])).toEqual({ all: 3, open: 1, pending: 1, completed: 1 })
  })

  it('is all zero on an empty list', () => {
    expect(workOrderTabCounts([])).toEqual({ all: 0, open: 0, pending: 0, completed: 0 })
  })
})
