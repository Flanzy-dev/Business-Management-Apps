// What the host does with an op it is about to accept — beyond "is it
// well-formed" (validateOpBatch in syncServer.ts).
//
// Sync merges whole rows, last write wins, in the order ops reach the host.
// That is fine for two people editing different things, and wrong for three
// cases a tablet that is behind can cause:
//
//   - It re-sends an order as 'open' after another device completed it, so the
//     order can be charged — and its stock taken — a second time.
//   - It edits a row another device has since DELETED, bringing it back.
//   - It retries a push whose answer was lost, and a naive "apply what was
//     posted" overwrites whatever landed in between.
//
// The host is the one place that sees every op in order, so it enforces the
// rules here and every device simply replays what the host kept. A refused op
// is not just dropped: the host appends a corrective op carrying the
// authoritative state, so the device that sent the stale write is pulled back
// into line through the normal pull (it has already forgotten the op as sent).
//
// Pure: lookups come in through `PushLookups`, the clock through `now`.
import type { OpRow } from './db'

/** Row ids in these units are never reused once deleted (they are uuids), so an
 *  upsert for a deleted id can only be a stale device bringing it back.
 *  Deliberately NOT every list unit: bays and the seeded service-item types
 *  have fixed ids that the app can legitimately create again after a delete. */
const NO_RESURRECTION: ReadonlySet<string> = new Set([
  'work-order-store/workOrders',
  'vehicle-store/vehicles',
  'customer-store/customers',
  'company-store/companies',
  'expense-store/expenses',
  'appointment-storage/appointments',
])

/** A work order only ever moves forward: open → completed → cancelled. */
const STATUS_RANK: Readonly<Record<string, number>> = { open: 0, completed: 1, cancelled: 2 }
const WORK_ORDERS = 'work-order-store/workOrders'

function unitOf(op: Pick<OpRow, 'entity' | 'field'>): string {
  return `${op.entity}/${op.field}`
}

function rowKey(op: Pick<OpRow, 'entity' | 'field' | 'entityId'>): string {
  return JSON.stringify([op.entity, op.field, op.entityId])
}

export interface PushLookups {
  /** The stored op with this id, if the host already has it. */
  stored(id: string): OpRow | null
  /** True when the oplog holds a delete for this row. */
  isDeleted(entity: string, field: string, entityId: string): boolean
  /** The row as currently materialized, or null. */
  currentRow(entity: string, field: string, entityId: string): Record<string, unknown> | null
}

export type PushAction =
  /** Accept: insert into the oplog and apply. */
  | { kind: 'insert' }
  /** A retry of an op the host already holds — answer with its seq, apply nothing. */
  | { kind: 'duplicate'; existingId: string }
  /** Refuse, and tell the sender what the row really is. */
  | { kind: 'drop'; reason: 'deleted-row' | 'status-regression'; corrective: OpRow }

export interface PushPlan {
  /** One per input op, same order. */
  actions: PushAction[]
  /** Input indexes whose id is already used by a DIFFERENT op — never a retry. */
  conflicts: number[]
}

function sameOp(a: OpRow, b: OpRow): boolean {
  return (
    a.device === b.device &&
    a.entity === b.entity &&
    a.field === b.field &&
    a.entityId === b.entityId &&
    a.kind === b.kind &&
    a.payload === b.payload
  )
}

function statusOf(payload: string): string | null {
  try {
    const row: unknown = JSON.parse(payload)
    const status = (row as { status?: unknown } | null)?.status
    return typeof status === 'string' ? status : null
  } catch {
    return null
  }
}

/** Decide, op by op, what happens to a pushed batch. Earlier ops in the batch
 *  count as already applied when judging later ones. */
export function planPush(ops: OpRow[], lookups: PushLookups, now: Date): PushPlan {
  const actions: PushAction[] = []
  const conflicts: number[] = []
  const deletedInBatch = new Set<string>()
  // The latest accepted work-order upsert per row in this batch: its status and
  // the full payload, which becomes the corrective if a later op regresses it.
  const orderInBatch = new Map<string, { status: string | null; payload: string }>()
  const stamp = now.toISOString()

  ops.forEach((op, index) => {
    const stored = lookups.stored(op.id)
    if (stored) {
      if (sameOp(stored, op)) actions.push({ kind: 'duplicate', existingId: stored.id })
      else {
        conflicts.push(index)
        actions.push({ kind: 'insert' }) // never used: the caller rejects the whole batch
      }
      return
    }

    const key = rowKey(op)
    if (op.kind === 'delete') {
      deletedInBatch.add(key)
      actions.push({ kind: 'insert' })
      return
    }

    if (NO_RESURRECTION.has(unitOf(op)) && (deletedInBatch.has(key) || lookups.isDeleted(op.entity, op.field, op.entityId))) {
      actions.push({
        kind: 'drop',
        reason: 'deleted-row',
        corrective: { id: `fix:${op.id}`, device: 'server', entity: op.entity, field: op.field, entityId: op.entityId, kind: 'delete', payload: '', ts: stamp },
      })
      return
    }

    if (unitOf(op) === WORK_ORDERS && op.kind === 'upsert') {
      const incoming = statusOf(op.payload)
      const batched = orderInBatch.get(key)
      const current = batched ?? (() => {
        const row = lookups.currentRow(op.entity, op.field, op.entityId)
        return row ? { status: typeof row.status === 'string' ? row.status : null, payload: JSON.stringify(row) } : null
      })()
      const incomingRank = incoming ? STATUS_RANK[incoming] : undefined
      const currentRank = current?.status ? STATUS_RANK[current.status] : undefined
      if (current && incomingRank !== undefined && currentRank !== undefined && incomingRank < currentRank) {
        actions.push({
          kind: 'drop',
          reason: 'status-regression',
          corrective: { id: `fix:${op.id}`, device: 'server', entity: op.entity, field: op.field, entityId: op.entityId, kind: 'upsert', payload: current.payload, ts: stamp },
        })
        return
      }
      orderInBatch.set(key, { status: incoming, payload: op.payload })
    }

    actions.push({ kind: 'insert' })
  })

  return { actions, conflicts }
}
