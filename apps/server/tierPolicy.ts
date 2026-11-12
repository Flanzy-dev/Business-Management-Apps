import type { OpRow } from './db'

// What a WORKER-tier sync token may write. The renderer's permissions are
// usability, not a security boundary: a worker tablet's token can also be used
// from a hand-written HTTP request, so the host enforces the same limits.
//
// The limit is "things a worker cannot do at the counter", not "anything that
// looks destructive". The counter itself creates orders, completes them,
// collects a customer's outstanding payment, deletes an open order that was
// opened by mistake, and cancels an appointment — refusing those would not
// make the shop safer, it would make a tablet's own work disappear. A refused
// op is dropped by the client for good (it can never succeed), so every rule
// here has to match what the UI really offers a worker.

const WORK_ORDERS = 'work-order-store/workOrders'

/** Stores a worker never writes. Stock arrives through the append-only
 *  movement/lot stores instead (receiving needs no product edit). */
const WORKER_READ_ONLY_ENTITIES = new Set([
  'expense-store',
  'settings-store',
  'supplier-store',
  'inventory-store',
  'product-category-store',
  'service-catalog-store',
])

/** Rows a worker may delete: cancelling an appointment, clearing a follow-up. */
const WORKER_MAY_DELETE = new Set(['appointment-storage/appointments', 'reminder-follow-up-store/followUps'])

/** The only fields collecting an outstanding payment changes (orderLifecycle's applyPayment). */
const PAYMENT_FIELDS = new Set(['paymentMethod', 'amountReceived', 'paidAt'])

export interface TierPolicyLookups {
  currentRow(entity: string, field: string, entityId: string): Record<string, unknown> | null
}

export interface TierPolicyRejection {
  index: number
  code: 'forbidden'
  reason: string
}

function parsedRow(op: OpRow): Record<string, unknown> | null {
  if (op.kind === 'delete') return null
  try {
    const value: unknown = JSON.parse(op.payload)
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null
  } catch {
    return null
  }
}

/** True when `incoming` differs from `current` only in payment fields. */
function onlyPaymentChanged(current: Record<string, unknown>, incoming: Record<string, unknown>): boolean {
  const keys = new Set([...Object.keys(current), ...Object.keys(incoming)])
  for (const key of keys) {
    if (PAYMENT_FIELDS.has(key)) continue
    if (JSON.stringify(current[key]) !== JSON.stringify(incoming[key])) return false
  }
  return true
}

function statusOf(row: Record<string, unknown> | null): string | null {
  return typeof row?.status === 'string' ? row.status : null
}

/** Why a worker token may not apply this op, or null if it may. */
function workerRefusal(op: OpRow, lookups: TierPolicyLookups): string | null {
  const unit = `${op.entity}/${op.field}`

  if (op.kind === 'delete') {
    if (WORKER_MAY_DELETE.has(unit)) return null
    if (unit === WORK_ORDERS) {
      // An order that was never booked can be deleted; a booked one is a sale
      // (its stock moved), and removing it is the admin's decision.
      const current = lookups.currentRow(op.entity, op.field, op.entityId)
      return current === null || statusOf(current) === 'open' ? null : 'worker tokens cannot delete a booked work order'
    }
    return 'worker tokens cannot delete synced rows'
  }

  if (WORKER_READ_ONLY_ENTITIES.has(op.entity)) return `${op.entity} is admin-only`
  if (unit !== WORK_ORDERS) return null

  const current = lookups.currentRow(op.entity, op.field, op.entityId)
  const incoming = parsedRow(op)
  const currentStatus = statusOf(current)
  const incomingStatus = statusOf(incoming)

  if (currentStatus === 'completed' || currentStatus === 'cancelled') {
    // Collecting a customer's debt re-saves a completed order with only its
    // payment fields changed — the one edit a booked order takes from a worker.
    const collectingDebt =
      currentStatus === 'completed' &&
      incomingStatus === 'completed' &&
      current?.paymentMethod === 'pending' &&
      incoming !== null &&
      onlyPaymentChanged(current, incoming)
    return collectingDebt ? null : 'worker tokens cannot rewrite a booked work order'
  }
  if (incomingStatus === 'cancelled') return 'worker tokens cannot void a work order'
  return null
}

/** Server-side authorization for a worker-tier sync token. */
export function validateWorkerBatch(ops: OpRow[], lookups: TierPolicyLookups): TierPolicyRejection[] {
  const rejected: TierPolicyRejection[] = []
  ops.forEach((op, index) => {
    const reason = workerRefusal(op, lookups)
    if (reason) rejected.push({ index, code: 'forbidden', reason })
  })
  return rejected
}

/**
 * Corrective ops for the refused ones: the authoritative row, appended to the
 * oplog so the tablet that attempted the edit is pulled back into line. A
 * refused op is dropped client-side for good, so without this the tablet would
 * keep showing a change the shop never accepted. A refused edit to a row the
 * host doesn't hold needs nothing.
 */
export function workerCorrectives(
  ops: OpRow[],
  rejected: TierPolicyRejection[],
  lookups: TierPolicyLookups,
  now: Date
): OpRow[] {
  const correctives: OpRow[] = []
  for (const { index } of rejected) {
    const op = ops[index]
    const current = lookups.currentRow(op.entity, op.field, op.entityId)
    if (!current) continue
    correctives.push({
      id: `fix:${op.id}`,
      device: 'server',
      entity: op.entity,
      field: op.field,
      entityId: op.entityId,
      kind: 'upsert',
      payload: JSON.stringify(current),
      ts: now.toISOString(),
    })
  }
  return correctives
}
