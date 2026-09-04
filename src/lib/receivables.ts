// Shop-wide view over unpaid ("invoice later") work orders — same shape as
// src/lib/reminders.ts's shop-wide view over due services: no store access,
// callers pass in the orders array and render the result. Reuses
// scheduleEngine.ts's dueDateTone rather than inventing a second overdue/
// due-soon rule, so "how many days out counts as due soon" stays one answer
// shared with the service schedule.
import type { WorkOrder } from '../store/workOrderStore'
import { dueDateTone, type DueTone } from './scheduleEngine'
import { dayKeyLocal } from './dateKeys'
import { translate } from './i18n'

const TONE_RANK: Record<DueTone, number> = { overdue: 3, due_soon: 2, on_track: 1 }

export interface Receivable {
  order: WorkOrder
  dueDate: string | null
  tone: DueTone
}

/**
 * Every completed order still awaiting payment, worst first. An order
 * completed before due dates existed (or whose due date was left blank)
 * carries no dueDate and sorts as on_track — visible as still-unpaid, just
 * not urgency-ranked, rather than silently dropped from the list.
 */
/** Finished, but the money hasn't come in yet. */
export function isUnpaidCompleted(order: WorkOrder): boolean {
  return order.status === 'completed' && order.paymentMethod === 'pending'
}

/**
 * What a status badge should read: a completed-but-unpaid order displays as
 * 'pending' rather than 'completed', so "done" and "paid" aren't conflated in
 * the UI. The stored `order.status` itself is never 'pending' — this is a
 * display-only derivation, not a lifecycle state (see orderLifecycle.ts).
 */
export function orderDisplayStatus(order: WorkOrder): 'open' | 'completed' | 'cancelled' | 'pending' {
  return isUnpaidCompleted(order) ? 'pending' : order.status
}

export function outstandingReceivables(
  orders: WorkOrder[],
  now: Date = new Date(),
  dueSoonWindowDays = 3
): Receivable[] {
  const receivables: Receivable[] = orders
    .filter(isUnpaidCompleted)
    .map((order) => {
      const dueDate = order.paymentDueDate ?? null
      const tone: DueTone = dueDate ? dueDateTone(dueDate, now, dueSoonWindowDays) : 'on_track'
      return { order, dueDate, tone }
    })
  return receivables.sort((a, b) => TONE_RANK[b.tone] - TONE_RANK[a.tone])
}

/** `termDays` out from `from`, as the 'YYYY-MM-DD' a date input expects. */
export function defaultPaymentDueDate(from: Date, termDays: number): string {
  const due = new Date(from)
  due.setDate(due.getDate() + termDays)
  return dayKeyLocal(due)
}

export function receivableStatusLabel(receivable: Receivable): string {
  if (receivable.tone === 'overdue') return translate('receivables.statusOverdue')
  if (receivable.tone === 'due_soon') return translate('receivables.statusDueSoon')
  return translate('receivables.statusUnpaid')
}

export function receivableBadgeTone(receivable: Receivable): 'neutral' | 'warning' | 'danger' {
  if (receivable.tone === 'overdue') return 'danger'
  if (receivable.tone === 'due_soon') return 'warning'
  return 'neutral'
}

/** The drafted payment-reminder text, translated via the caller's own t() —
 *  same pattern as src/lib/reminders.ts's buildReminderMessage. */
export function buildPaymentReminderMessage(
  t: (key: string, vars?: Record<string, string | number>) => string,
  ownerName: string,
  orderLabel: string,
  amount: string,
  dueDate: string | null
): string {
  return dueDate
    ? t('receivables.messageTemplateWithDate', { owner: ownerName, order: orderLabel, amount, due: dueDate })
    : t('receivables.messageTemplate', { owner: ownerName, order: orderLabel, amount })
}
