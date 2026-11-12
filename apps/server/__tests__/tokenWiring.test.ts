import { describe, it, expect } from 'vitest'
import { buildTokenWiring } from '../tokenWiring'
import { tokenRole } from '../syncServer'
import type { SyncDatabase } from '../db'

function dbWith(rows: Record<string, string>): SyncDatabase {
  return {
    getItem: (k) => rows[k] ?? null,
    setItem: () => {},
    removeItem: () => {},
    opsInsertOne: () => null,
    opsGetById: () => null,
    opsHasDelete: () => false,
    opsSince: () => [],
    snapshot: () => ({}),
    currentMaxSeq: () => 0,
    deviceActivity: () => [],
    materializeOps: () => {},
    persist: () => {},
    getLastPersistError: () => null,
  }
}

function shopWith(security: Record<string, unknown>): SyncDatabase {
  return dbWith({ 'security-store': JSON.stringify({ state: { security }, version: 0 }) })
}

const SHOP = { adminPasswordHash: 'hash', lanToken: 'shop-admin-token', workerLanToken: 'shop-worker-token' }

// server/index.ts used to wire SHOP_TOKEN as BOTH tiers' token and hand it to
// whichever role signed in at /api/login. tokenRole() checks the admin getter
// first, so a worker account walked away with an admin-tier credential: the
// one that unredacts the admin hashes and is accepted for security-store writes.
describe('buildTokenWiring with SHOP_TOKEN set', () => {
  const wiring = buildTokenWiring(shopWith(SHOP), 'operator-secret')
  const roleOf = (presented: string) => tokenRole([presented], wiring.token(), wiring.workerToken())

  it('treats SHOP_TOKEN as the admin-tier token', () => {
    expect(wiring.token()).toBe('operator-secret')
    expect(roleOf('operator-secret')).toBe('admin')
  })

  it('does NOT hand a worker login the SHOP_TOKEN', () => {
    expect(wiring.getLanToken('worker')).toBe('shop-worker-token')
    expect(wiring.getLanToken('worker')).not.toBe('operator-secret')
  })

  it('the token a worker login receives is worker-tier, not admin-tier', () => {
    const handedToWorker = wiring.getLanToken('worker')!
    expect(roleOf(handedToWorker)).toBe('worker')
  })

  it('still hands an admin login the SHOP_TOKEN, which the gate accepts', () => {
    expect(wiring.getLanToken('admin')).toBe('operator-secret')
    expect(roleOf(wiring.getLanToken('admin')!)).toBe('admin')
  })

  it('does not accept the shop worker token as admin', () => {
    expect(wiring.workerToken()).toBe('shop-worker-token')
    expect(roleOf('shop-worker-token')).toBe('worker')
  })

  it('hands a worker login nothing, rather than SHOP_TOKEN, when no worker token exists yet', () => {
    const noWorkerToken = buildTokenWiring(shopWith({ ...SHOP, workerLanToken: null }), 'operator-secret')
    expect(noWorkerToken.getLanToken('worker')).toBeNull()
  })
})

describe('buildTokenWiring without SHOP_TOKEN', () => {
  const wiring = buildTokenWiring(shopWith(SHOP), undefined)

  it('follows the shop\'s own tokens, one per tier', () => {
    expect(wiring.token()).toBe('shop-admin-token')
    expect(wiring.workerToken()).toBe('shop-worker-token')
    expect(wiring.getLanToken('admin')).toBe('shop-admin-token')
    expect(wiring.getLanToken('worker')).toBe('shop-worker-token')
  })

  it('re-reads the shop data on every call instead of caching it', () => {
    const rows: Record<string, string> = {}
    const live = buildTokenWiring(dbWith(rows), undefined)
    expect(live.token()).toBeUndefined()
    rows['security-store'] = JSON.stringify({ state: { security: SHOP }, version: 0 })
    expect(live.token()).toBe('shop-admin-token')
  })
})
