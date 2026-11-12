// What a WORKER-tier caller of /api/snapshot and /api/ops is not shown.
//
// security-store is one synced singleton, so the whole object — the admin LAN
// token, the admin password hash, the admin recovery-code hash — used to be
// served to every device that presented ANY valid token. That quietly defeated
// the worker/admin token split: syncServer.ts's validateOpBatch only accepts a
// security-store write that carries the ADMIN token, but a worker device could
// simply read that token out of its own snapshot and present it, replacing the
// admin password. (The hash alone also lets it guess passwords offline.)
//
// A placeholder is substituted rather than null or an empty string. Several
// places treat these fields' presence as meaning something: an admin hash that
// looks absent makes the lock screen offer to CREATE an admin account, and a
// missing admin token or recovery code makes src/lib/auth/securityCompleteness.ts
// mint a new one on that device and try to push it. The placeholder is truthy
// (so "an admin exists" and "the token exists" stay true), fails to verify as
// any password (src/lib/auth/password.ts / server/passwordVerify.ts need five
// `$`-separated parts), and is never a credential the server accepts.
//
// Unrelated to who may WRITE security-store: that remains validateOpBatch's job.
import type { OpRow } from './db'

export const REDACTED = 'redacted'

/** The security-store fields a worker device has no use for and must not hold.
 *  The worker's own account (username, hash) and `workerLanToken` are NOT here —
 *  a worker device signs workers in locally and syncs with its own token. */
const ADMIN_ONLY_FIELDS = ['lanToken', 'adminPasswordHash', 'adminRecoveryCodeHash'] as const

function redactSecurityObject(security: unknown): unknown {
  if (typeof security !== 'object' || security === null || Array.isArray(security)) return security
  const copy: Record<string, unknown> = { ...(security as Record<string, unknown>) }
  for (const field of ADMIN_ONLY_FIELDS) {
    // Only a real value is replaced: a null stays null, so "no admin account
    // yet" is still reported as exactly that.
    if (typeof copy[field] === 'string' && copy[field] !== '') copy[field] = REDACTED
  }
  return copy
}

/** A persisted security-store row — `{"state":{"security":{…}},"version":n}`.
 *  Returned unchanged if it isn't that shape (nothing structured to redact). */
export function redactSecurityStoreBlob(blob: string): string {
  try {
    const parsed = JSON.parse(blob)
    if (!parsed?.state || !('security' in parsed.state)) return blob
    return JSON.stringify({ ...parsed, state: { ...parsed.state, security: redactSecurityObject(parsed.state.security) } })
  } catch {
    return blob
  }
}

// ---- business data a worker's tablet never shows -----------------------------
//
// Beyond credentials, a worker-tier token used to read the shop's books: every
// expense, every supplier, the activity log. None of it appears in Worker mode
// (permissions.ts), so none of it needs to leave the host for a tablet.
//
// What is NOT hidden is just as deliberate: product cost price and lot unit
// costs. A worker completes orders on the tablet, and the till freezes each
// line's cost of goods from exactly those figures (src/lib/ops/orderOps.ts) —
// blank them and every tablet sale books a cost of zero into the P&L. Hiding
// them properly means costing on the host, which is a larger change; until
// then the worker-visible cost data is the accepted residual.

/** Units served empty to a worker: [entity, field]. */
const HIDDEN_FROM_WORKER: readonly (readonly [string, string])[] = [
  ['expense-store', 'expenses'],
  ['supplier-store', 'suppliers'],
  ['activity-log-store', 'entries'],
]

const isHiddenUnit = (entity: string, field: string) => HIDDEN_FROM_WORKER.some(([e, f]) => e === entity && f === field)

/** The supplier's price-list code encodes the shop's cost ("modal"); only Admin sees it. */
function blankSupplierCode(row: unknown): unknown {
  if (typeof row !== 'object' || row === null || Array.isArray(row)) return row
  const product = row as Record<string, unknown>
  return typeof product.supplierCode === 'string' && product.supplierCode !== '' ? { ...product, supplierCode: '' } : row
}

/** One persisted store blob with its worker-hidden parts removed. */
function redactBusinessBlob(entity: string, blob: string): string {
  try {
    const parsed = JSON.parse(blob)
    const state = parsed?.state
    if (typeof state !== 'object' || state === null) return blob
    const next: Record<string, unknown> = { ...state }
    for (const [hiddenEntity, field] of HIDDEN_FROM_WORKER) {
      if (hiddenEntity === entity && Array.isArray(next[field])) next[field] = []
    }
    if (entity === 'inventory-store' && Array.isArray(next.products)) next.products = next.products.map(blankSupplierCode)
    return JSON.stringify({ ...parsed, state: next })
  } catch {
    return blob
  }
}

/** A full key_value_store snapshot with the worker-hidden fields redacted. */
export function redactSnapshotForWorker(data: Record<string, string>): Record<string, string> {
  const businessEntities = [...new Set([...HIDDEN_FROM_WORKER.map(([e]) => e), 'inventory-store'])]
  // Nothing here to redact: hand back the very same object.
  if (data['security-store'] === undefined && businessEntities.every((e) => data[e] === undefined)) return data

  const result = { ...data }
  const security = result['security-store']
  if (security !== undefined) result['security-store'] = redactSecurityStoreBlob(security)
  for (const entity of businessEntities) {
    if (result[entity] !== undefined) result[entity] = redactBusinessBlob(entity, result[entity])
  }
  return result
}

/** Ops as served by GET /api/ops. A security-store upsert's payload is the whole
 *  `security` object, so it needs the same treatment as the snapshot. A hidden
 *  unit's ops stay in the feed — the cursor counts on every seq arriving — but
 *  as deletes of rows the tablet never held, which change nothing. */
export function redactOpsForWorker<T extends Pick<OpRow, 'entity' | 'field' | 'kind' | 'payload'>>(ops: T[]): T[] {
  return ops.map((op) => {
    if (isHiddenUnit(op.entity, op.field)) return op.kind === 'delete' ? op : { ...op, kind: 'delete', payload: '' }
    if (op.kind === 'delete') return op
    try {
      if (op.entity === 'security-store' && op.field === 'security') {
        return { ...op, payload: JSON.stringify(redactSecurityObject(JSON.parse(op.payload))) }
      }
      if (op.entity === 'inventory-store' && op.field === 'products') {
        return { ...op, payload: JSON.stringify(blankSupplierCode(JSON.parse(op.payload))) }
      }
    } catch {
      return op
    }
    return op
  })
}
