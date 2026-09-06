// The renderer and the LAN server have to agree on the shape of an op, and
// they are compiled as two separate programs — the server half only sees the
// five renderer files tsconfig.server.json's include list lets through. Three
// declarations of that one shape used to sit side by side with nothing
// comparing them:
//
//   - src/lib/sync/types.ts's SyncOp        (renderer)
//   - server/db.ts's OpRow                  (server, and it weakened `kind`
//                                            from SyncOpKind to `string`)
//   - server/db.ts's OPS_TABLE_SQL          (the actual SQLite columns)
//
// plus SyncOpKind duplicated at runtime as a hand-written Set. OpRow is now an
// alias of SyncOp and the Set is built from SYNC_OP_KINDS, so those two can no
// longer drift. The table columns still can — SQL is a string, invisible to
// the compiler — which is what this file is for. It is the same kind of guard
// storeVersions.test.ts is, and exists for the same reason: a silent
// divergence here would look like nothing at all until a row failed to
// round-trip on a device someone else owns.
import { describe, it, expect } from 'vitest'
import { SYNC_OP_FIELDS, SYNC_OP_KINDS } from '../sync/types'
import { OPS_TABLE_SQL, isOpRow } from '../../../server/db'

/** The column names out of the CREATE TABLE, in declaration order. */
function opsTableColumns(): string[] {
  const body = OPS_TABLE_SQL.slice(OPS_TABLE_SQL.indexOf('(') + 1, OPS_TABLE_SQL.lastIndexOf(')'))
  return body
    .split(',')
    .map((line) => line.trim().split(/\s+/)[0])
    .filter(Boolean)
}

describe('the ops table matches SyncOp', () => {
  it('has exactly SyncOp\'s fields, plus the server-assigned seq', () => {
    expect(opsTableColumns()).toEqual(['seq', ...SYNC_OP_FIELDS])
  })

  it('does not carry seq as a SyncOp field — the server assigns it', () => {
    expect(SYNC_OP_FIELDS).not.toContain('seq')
  })
})

describe('isOpRow enforces the shape the table stores', () => {
  const valid = {
    id: 'op-1', device: 'dev-1', entity: 'customer-store', field: 'customers',
    entityId: 'c-1', kind: 'upsert', payload: '{}', ts: '2026-01-01T00:00:00.000Z',
  }

  it('accepts a well-formed op', () => {
    expect(isOpRow(valid)).toBe(true)
  })

  it('accepts every kind in SYNC_OP_KINDS — the runtime Set is built from it', () => {
    for (const kind of SYNC_OP_KINDS) expect(isOpRow({ ...valid, kind })).toBe(true)
  })

  it('rejects a kind outside the union', () => {
    expect(isOpRow({ ...valid, kind: 'replace' })).toBe(false)
  })

  it('rejects a row missing any one of SyncOp\'s fields', () => {
    for (const field of SYNC_OP_FIELDS) {
      const { [field]: _dropped, ...missing } = valid
      expect(isOpRow(missing), `expected a row with no "${field}" to be rejected`).toBe(false)
    }
  })
})
