// The "thanks, and here is when to come back" message offered after a visit is
// charged. The next-due rows are the ones the receipt already prints
// (receiptDueLines.ts), so the message and the paper can never disagree.
//
// Pure: strings come in through the caller's t().
import { formatDistance } from '../format/numbers'
import { formatDate } from '../format/dates'
import type { ReceiptDueLine } from './receiptDueLines'

/** At most this many rows in a chat message: a list of seven marks is a
 *  receipt, not a message anyone reads. */
const MAX_ROWS = 3

/**
 * "Oli Mesin 55.000 km / 12 Mar 2027, Filter Oli …" — the soonest marks, or
 * null when there is nothing scheduled to tell the customer about.
 */
export function formatNextDue(rows: ReceiptDueLine[], limit = MAX_ROWS): string | null {
  if (rows.length === 0) return null
  return rows
    .slice(0, limit)
    .map((row) => {
      const marks = [row.dueKm != null ? formatDistance(row.dueKm) : null, row.dueDate != null ? formatDate(row.dueDate) : null]
        .filter(Boolean)
        .join(' / ')
      return marks ? `${row.what} ${marks}` : row.what
    })
    .join(', ')
}

export function buildThankYouMessage(
  t: (key: string, vars?: Record<string, string | number>) => string,
  details: { owner: string; vehicle: string; shop: string; nextDue: string | null }
): string {
  const { owner, vehicle, shop, nextDue } = details
  return nextDue
    ? t('reminders.thankYouMessageWithNext', { owner, vehicle, shop, next: nextDue })
    : t('reminders.thankYouMessage', { owner, vehicle, shop })
}
