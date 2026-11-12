import { describe, it, expect } from 'vitest'
import type { WorkOrder } from '../../store/workOrderStore'
import { outstandingReceivables, defaultPaymentDueDate, orderDisplayStatus, receivableStatusLabel, receivableBadgeTone, buildPaymentReminderMessage } from '../orders/receivables'
import type { Receivable } from '../orders/receivables'

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

function receivable(overrides: Partial<Receivable> = {}): Receivable {
  return { order: order(), tone: 'on_track', dueDate: null, ...overrides }
}

describe('receivableStatusLabel / receivableBadgeTone', () => {
  it('pairs the overdue tone with a danger badge', () => {
    const r = receivable({ tone: 'overdue' })
    expect(receivableBadgeTone(r)).toBe('danger')
    expect(typeof receivableStatusLabel(r)).toBe('string')
  })

  it('pairs the due_soon tone with a warning badge', () => {
    const r = receivable({ tone: 'due_soon' })
    expect(receivableBadgeTone(r)).toBe('warning')
  })

  it('pairs on_track with a neutral badge, distinct from the other two labels', () => {
    const r = receivable({ tone: 'on_track' })
    expect(receivableBadgeTone(r)).toBe('neutral')
    expect(receivableStatusLabel(r)).not.toBe(receivableStatusLabel(receivable({ tone: 'overdue' })))
    expect(receivableStatusLabel(r)).not.toBe(receivableStatusLabel(receivable({ tone: 'due_soon' })))
  })
})

describe('buildPaymentReminderMessage', () => {
  const t = (key: string, vars?: Record<string, string | number>) =>
    key === 'receivables.messageTemplateWithDate'
      ? `Hi ${vars!.owner}, ${vars!.order} (${vars!.amount}) is due ${vars!.due}`
      : `Hi ${vars!.owner}, ${vars!.order} (${vars!.amount}) is unpaid`

  it('includes the due date when one is given', () => {
    const msg = buildPaymentReminderMessage(t, 'Budi', 'WO-1001', 'Rp 100.000', '2026-07-04')
    expect(msg).toBe('Hi Budi, WO-1001 (Rp 100.000) is due 2026-07-04')
  })

  it('omits the due date entirely when there is none', () => {
    const msg = buildPaymentReminderMessage(t, 'Budi', 'WO-1001', 'Rp 100.000', null)
    expect(msg).toBe('Hi Budi, WO-1001 (Rp 100.000) is unpaid')
    expect(msg).not.toContain('due')
  })
})
