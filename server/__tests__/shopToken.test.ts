import { describe, it, expect } from 'vitest'
import { readShopToken, readWorkerShopToken } from '../shopToken'
import type { SyncDatabase } from '../db'

/** Only getItem is exercised by readShopToken; the rest of the interface is
 *  stubbed so the test doesn't need a real database. */
function dbWith(rows: Record<string, string>): SyncDatabase {
  return {
    getItem: (k) => rows[k] ?? null,
    setItem: () => {},
    removeItem: () => {},
    opsInsertOne: () => null,
    opsSince: () => [],
    snapshot: () => ({}),
    currentMaxSeq: () => 0,
    materializeOps: () => {},
    persist: () => {},
    getLastPersistError: () => null,
  }
}

function securityRow(security: Record<string, unknown>): Record<string, string> {
  return { 'security-store': JSON.stringify({ state: { security }, version: 0 }) }
}

// This is the fix for the LAN takeover: an unauthenticated device on the
// shop's WiFi used to be able to read (GET /api/snapshot, GET /api/ops) and
// write (POST /api/ops) the WHOLE shop database, including both password
// hashes and the LAN token, the moment lanTokenRequired's default of false
// met a shop that had never visited Settings to flip it on. The fix is that
// an admin account existing is now ALSO a reason to demand the token,
// independent of the switch.
describe('readShopToken', () => {
  it('demands nothing when no token has ever been generated', () => {
    expect(readShopToken(dbWith(securityRow({ lanToken: null, adminPasswordHash: 'hash' })))).toBeUndefined()
    expect(readShopToken(dbWith({}))).toBeUndefined()
  })

  it('stays open pre-account: a token exists but the shop has no admin account and the switch is off', () => {
    // The deliberate bootstrap window — a first device has to be able to
    // reach the shop before there's anything to protect.
    expect(
      readShopToken(dbWith(securityRow({ lanToken: 'abcd-efgh-jkmn', adminPasswordHash: null, lanTokenRequired: false })))
    ).toBeUndefined()
  })

  it('demands the token the moment an admin account exists, even with the switch off', () => {
    // THE fix. Before this clause, this exact state — the shop's actual
    // shipping default the instant someone creates an account — left
    // /api/snapshot and POST /api/ops wide open on the WiFi.
    expect(
      readShopToken(dbWith(securityRow({ lanToken: 'abcd-efgh-jkmn', adminPasswordHash: 'hash', lanTokenRequired: false })))
    ).toBe('abcd-efgh-jkmn')
  })

  it('still demands the token when the switch is explicitly on, account or not', () => {
    expect(
      readShopToken(dbWith(securityRow({ lanToken: 'abcd-efgh-jkmn', adminPasswordHash: null, lanTokenRequired: true })))
    ).toBe('abcd-efgh-jkmn')
    expect(
      readShopToken(dbWith(securityRow({ lanToken: 'abcd-efgh-jkmn', adminPasswordHash: 'hash', lanTokenRequired: true })))
    ).toBe('abcd-efgh-jkmn')
  })

  it('never demands an empty or whitespace-only token', () => {
    expect(readShopToken(dbWith(securityRow({ lanToken: '', adminPasswordHash: 'hash' })))).toBeUndefined()
    expect(readShopToken(dbWith(securityRow({ lanToken: '   ', adminPasswordHash: 'hash' })))).toBeUndefined()
  })

  it('never throws on a corrupt or unexpected row', () => {
    for (const row of ['not json', '{}', '{"state":null}', 'null']) {
      expect(() => readShopToken(dbWith({ 'security-store': row }))).not.toThrow()
      expect(readShopToken(dbWith({ 'security-store': row }))).toBeUndefined()
    }
  })
})

// The worker-tier counterpart, for POST /api/login's worker branch and
// createSyncServer's `workerToken` option (server/syncServer.ts) — a
// DIFFERENT secret from readShopToken's above, on purpose: a worker
// credential must not be indistinguishable from an admin one at the token
// gate, or a worker password could be used to rewrite the shop's admin
// account over the LAN (see src/store/securityStore.ts's workerLanToken
// doc). Shares the identical "is a token required at all" gate as
// readShopToken — there is no independent "require the worker token but not
// the admin one" state — just reads `workerLanToken` instead of `lanToken`
// as the value.
describe('readWorkerShopToken', () => {
  it('demands nothing when no worker token has ever been generated', () => {
    expect(
      readWorkerShopToken(dbWith(securityRow({ workerLanToken: null, adminPasswordHash: 'hash' })))
    ).toBeUndefined()
    expect(readWorkerShopToken(dbWith({}))).toBeUndefined()
  })

  it('is a genuinely different value from the admin token when both are set', () => {
    const db = dbWith(securityRow({ lanToken: 'admin-tok', workerLanToken: 'worker-tok', adminPasswordHash: 'hash' }))
    expect(readShopToken(db)).toBe('admin-tok')
    expect(readWorkerShopToken(db)).toBe('worker-tok')
  })

  it('stays open pre-account, same as the admin token', () => {
    expect(
      readWorkerShopToken(
        dbWith(securityRow({ workerLanToken: 'abcd-efgh-jkmn', adminPasswordHash: null, lanTokenRequired: false }))
      )
    ).toBeUndefined()
  })

  it('demands the worker token the moment an admin account exists, even with the switch off', () => {
    expect(
      readWorkerShopToken(
        dbWith(securityRow({ workerLanToken: 'abcd-efgh-jkmn', adminPasswordHash: 'hash', lanTokenRequired: false }))
      )
    ).toBe('abcd-efgh-jkmn')
  })

  it('never demands an empty or whitespace-only worker token', () => {
    expect(readWorkerShopToken(dbWith(securityRow({ workerLanToken: '', adminPasswordHash: 'hash' })))).toBeUndefined()
    expect(readWorkerShopToken(dbWith(securityRow({ workerLanToken: '   ', adminPasswordHash: 'hash' })))).toBeUndefined()
  })

  it('never throws on a corrupt or unexpected row', () => {
    for (const row of ['not json', '{}', '{"state":null}', 'null']) {
      expect(() => readWorkerShopToken(dbWith({ 'security-store': row }))).not.toThrow()
      expect(readWorkerShopToken(dbWith({ 'security-store': row }))).toBeUndefined()
    }
  })
})
