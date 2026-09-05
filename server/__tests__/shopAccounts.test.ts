import { describe, it, expect } from 'vitest'
import { readShopAccounts, readLanTokenForHandover } from '../shopAccounts'
import type { SyncDatabase } from '../db'

/** Only getItem is ever exercised by these readers; the rest of the
 *  interface is stubbed so the test doesn't need a real database. */
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

/** The zustand-persist envelope securityStore actually writes. Building it
 *  here (rather than asserting against a hand-written flat object) is the
 *  point: the readers navigate `.state.security`, and getting that nesting
 *  wrong fails SILENTLY — no account found, every login rejected. */
function securityRow(security: Record<string, unknown>): Record<string, string> {
  return { 'security-store': JSON.stringify({ state: { security }, version: 0 }) }
}

describe('readShopAccounts', () => {
  it('reads both accounts out of the persist envelope', () => {
    const accounts = readShopAccounts(
      dbWith(
        securityRow({
          adminUsername: 'Budi',
          adminPasswordHash: 'hash-a',
          workerUsername: 'bengkel',
          workerPasswordHash: 'hash-w',
        })
      )
    )
    expect(accounts).toEqual([
      { role: 'admin', username: 'Budi', passwordHash: 'hash-a' },
      { role: 'worker', username: 'bengkel', passwordHash: 'hash-w' },
    ])
  })

  it('lists admin before worker, so a duplicated name resolves to admin', () => {
    const accounts = readShopAccounts(
      dbWith(
        securityRow({
          adminUsername: 'same',
          adminPasswordHash: 'hash-a',
          workerUsername: 'same',
          workerPasswordHash: 'hash-w',
        })
      )
    )
    expect(accounts.map((a) => a.role)).toEqual(['admin', 'worker'])
  })

  it('skips admin entirely when the HASH is missing — that is the only thing that makes an admin account absent', () => {
    expect(
      readShopAccounts(dbWith(securityRow({ adminUsername: 'Budi', adminPasswordHash: null })))
    ).toEqual([])
  })

  it('includes an admin account with a real hash but NO recorded username — the legacy state this function used to wrongly exclude', () => {
    // This is the regression this whole file exists to guard: a real admin
    // password with adminUsername unset used to make the admin candidate
    // invisible to /api/login entirely, so it could never pair a second
    // device no matter how correct the password was. src/lib/auth/username.ts's
    // adminUsernameMatches (called from handleLogin) is what turns this null
    // into "matches anything typed" — this function only has to make sure the
    // account is present at all.
    expect(
      readShopAccounts(dbWith(securityRow({ adminUsername: null, adminPasswordHash: 'hash-a' })))
    ).toEqual([{ role: 'admin', username: null, passwordHash: 'hash-a' }])
  })

  it('treats a blank-but-present admin username the same as a missing one — null, not an empty string', () => {
    const accounts = readShopAccounts(
      dbWith(securityRow({ adminUsername: '   ', adminPasswordHash: 'hash-a' }))
    )
    expect(accounts).toEqual([{ role: 'admin', username: null, passwordHash: 'hash-a' }])
  })

  it('skips worker when EITHER half is missing — unlike admin, there is no legacy unnamed-worker state', () => {
    expect(
      readShopAccounts(dbWith(securityRow({ workerUsername: 'bengkel', workerPasswordHash: null })))
    ).toEqual([])
    expect(
      readShopAccounts(dbWith(securityRow({ workerUsername: null, workerPasswordHash: 'hash-w' })))
    ).toEqual([])
  })

  it('trims the stored username', () => {
    const accounts = readShopAccounts(dbWith(securityRow({ adminUsername: ' Budi ', adminPasswordHash: 'h' })))
    expect(accounts[0].username).toBe('Budi')
  })

  it('returns an empty list for a shop with no accounts yet', () => {
    // The brand-new-shop case, and the reason it matters: an empty list must
    // mean "reject every login", never "let anyone in".
    expect(readShopAccounts(dbWith(securityRow({})))).toEqual([])
    expect(readShopAccounts(dbWith({}))).toEqual([])
  })

  it('never throws on a corrupt or unexpected row', () => {
    for (const row of ['not json', '{}', '{"state":null}', '{"state":{"security":"nope"}}', 'null']) {
      expect(() => readShopAccounts(dbWith({ 'security-store': row }))).not.toThrow()
      expect(readShopAccounts(dbWith({ 'security-store': row }))).toEqual([])
    }
  })

  it('ignores a non-string hash rather than trusting it', () => {
    // Guards against a corrupted row where the hash arrived as an object or
    // a number — passing that to a verifier is how a crash becomes a 500.
    expect(readShopAccounts(dbWith(securityRow({ adminUsername: 'Budi', adminPasswordHash: 12345 })))).toEqual([])
  })
})

describe('readLanTokenForHandover', () => {
  it('returns the admin token even when it is not currently required', () => {
    // The whole reason this is separate from shopToken.ts's readShopToken:
    // a device that just authenticated should leave holding the token, so
    // switching "Require token on LAN" on later never locks it out.
    const db = dbWith(securityRow({ lanToken: 'abcd-efgh-jkmn', lanTokenRequired: false }))
    expect(readLanTokenForHandover(db, 'admin')).toBe('abcd-efgh-jkmn')
  })

  it('returns the WORKER token for the worker role — a different secret from the admin one', () => {
    const db = dbWith(securityRow({ lanToken: 'admin-tok', workerLanToken: 'worker-tok' }))
    expect(readLanTokenForHandover(db, 'admin')).toBe('admin-tok')
    expect(readLanTokenForHandover(db, 'worker')).toBe('worker-tok')
  })

  it('returns null when the shop has no token for that role', () => {
    expect(readLanTokenForHandover(dbWith(securityRow({ lanToken: null })), 'admin')).toBeNull()
    expect(readLanTokenForHandover(dbWith(securityRow({ lanToken: '  ' })), 'admin')).toBeNull()
    expect(readLanTokenForHandover(dbWith({}), 'admin')).toBeNull()
    expect(readLanTokenForHandover(dbWith(securityRow({ lanToken: 'abcd-efgh-jkmn' })), 'worker')).toBeNull()
  })

  it('never throws on a corrupt row', () => {
    expect(readLanTokenForHandover(dbWith({ 'security-store': 'not json' }), 'admin')).toBeNull()
  })
})
