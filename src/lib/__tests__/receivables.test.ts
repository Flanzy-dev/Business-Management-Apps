import { describe, it, expect } from 'vitest'
import type { WorkOrder } from '../../store/workOrderStore'
import { outstandingReceivables, defaultPaymentDueDate, orderDisplayStatus } from '../receivables'

let nextId = 1

function order(overrides: Partial<WorkOrder> = {}): WorkOrder {
  return {
    id: `wo-${nextId++}`,
    orderNumber: 1000 + nextId,
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
    paymentMethod: 'pending',
    status: 'completed',
    notes: '',
    createdAt: new Date(2026, 5, 15, 9, 0).toISOString(),
    completedAt: new Date(2026, 5, 15, 9, 0).toISOString(),
    ...overrides,
  }
}

describe('outstandingReceivables', () => {
  const now = new Date(2026, 6, 20)

  it('includes only completed orders still sitting at pending', () => {
    const paid = order({ paymentMethod: 'cash' })
    const openOrder = order({ status: 'open' })
    const voided = order({ status: 'cancelled' })
    const unpaid = order({ paymentDueDate: '2026-07-25' })
    const result = outstandingReceivables([paid, openOrder, voided, unpaid], now)
    expect(result.map(r => r.order.id)).toEqual([unpaid.id])
  })

  it('ranks overdue ahead of due-soon ahead of on-track', () => {
    const overdue = order({ id: 'overdue', paymentDueDate: '2026-07-01' })
    const dueSoon = order({ id: 'due-soon', paymentDueDate: '2026-07-21' })
    const onTrack = order({ id: 'on-track', paymentDueDate: '2026-09-01' })
    const result = outstandingReceivables([onTrack, overdue, dueSoon], now)
    expect(result.map(r => r.order.id)).toEqual(['overdue', 'due-soon', 'on-track'])
    expect(result.map(r => r.tone)).toEqual(['overdue', 'due_soon', 'on_track'])
  })

  it('keeps a legacy pending order with no due date visible as on_track rather than dropping it', () => {
    const legacy = order({ paymentDueDate: null })
    const result = outstandingReceivables([legacy], now)
    expect(result).toHaveLength(1)
    expect(result[0].tone).toBe('on_track')
    expect(result[0].dueDate).toBeNull()
  })

  it('gives the same tone late at night as early the next morning, for a due date one day out', () => {
    const dueTomorrow = order({ paymentDueDate: '2026-06-16' })
    const lateAtNight = outstandingReceivables([dueTomorrow], new Date(2026, 5, 15, 23, 59))
    const earlyMorning = outstandingReceivables([dueTomorrow], new Date(2026, 5, 15, 0, 1))
    expect(lateAtNight[0].tone).toBe(earlyMorning[0].tone)
  })
})

describe('orderDisplayStatus', () => {
  it('shows a completed-but-unpaid order as pending', () => {
    expect(orderDisplayStatus(order({ status: 'completed', paymentMethod: 'pending' }))).toBe('pending')
  })

  it('shows a completed and paid order as completed', () => {
    expect(orderDisplayStatus(order({ status: 'completed', paymentMethod: 'cash' }))).toBe('completed')
  })

  it('leaves an open order as open', () => {
    expect(orderDisplayStatus(order({ status: 'open' }))).toBe('open')
  })

  it('shows a voided order as cancelled, even though it kept its pending payment method', () => {
    expect(orderDisplayStatus(order({ status: 'cancelled', paymentMethod: 'pending' }))).toBe('cancelled')
  })
})

describe('defaultPaymentDueDate', () => {
  it('adds the term in days, as a YYYY-MM-DD string', () => {
    expect(defaultPaymentDueDate(new Date(2026, 5, 20), 14)).toBe('2026-07-04')
  })
})
