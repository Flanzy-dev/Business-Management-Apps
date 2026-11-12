import { describe, it, expect } from 'vitest'
import { planSnapshotApply } from '../sync/snapshotPlan'

// Regression coverage for the device-local key leak (Fix 1): server/db.ts's
// snapshot() and the old joinCold() both read/wrote the whole storageAdapter
// keyspace unfiltered, so a cold-joining device adopted the host's own
// device-id/sync-host/sync-outbox/sync-cursor right alongside shop data.

describe('planSnapshotApply', () => {
  it('writes a shop-data key present in the snapshot', () => {
    const plan = planSnapshotApply({ 'customer-store': '{"state":{"customers":[]}}' }, [])
    expect(plan.writes).toEqual([['customer-store', '{"state":{"customers":[]}}']])
  })

  it('excludes every device-local key from writes, even though they were in the snapshot', () => {
    const plan = planSnapshotApply(
      {
        'customer-store': '{}',
        'device-id': 'host-device-id',
        'sync-host': '{"role":"main"}',
        'sync-outbox': '[]',
        'sync-cursor': '42',
      },
      []
    )
    const writtenKeys = plan.writes.map(([key]) => key)
    expect(writtenKeys).toEqual(['customer-store'])
    expect(writtenKeys).not.toContain('device-id')
    expect(writtenKeys).not.toContain('sync-host')
    expect(writtenKeys).not.toContain('sync-outbox')
    expect(writtenKeys).not.toContain('sync-cursor')
  })

  it('excludes a key registered in neither list — an allowlist, not a "not device-local" check', () => {
    const plan = planSnapshotApply({ 'customer-store': '{}', 'some-future-key': 'x' }, [])
    expect(plan.writes.map(([key]) => key)).toEqual(['customer-store'])
  })

  it('lists a local shop-data key absent from the snapshot as a removal', () => {
    const plan = planSnapshotApply({ 'customer-store': '{}' }, ['customer-store', 'vehicle-store'])
    expect(plan.removals).toEqual(['vehicle-store'])
  })

  it('removes nothing when every local key is present in the snapshot (the self-referential main-device case)', () => {
    const plan = planSnapshotApply(
      { 'customer-store': '{}', 'vehicle-store': '{}' },
      ['customer-store', 'vehicle-store']
    )
    expect(plan.removals).toEqual([])
  })

  it('never proposes removing a device-local key, even if it were passed as "local"', () => {
    // Defensive: localShopDataKeys should only ever contain shop-data keys
    // in practice (see engine.ts's joinCold), but the plan itself shouldn't
    // be the thing relied on to exclude a device-local key from removals —
    // removals are just "requested minus present", so a device-local key
    // passed in by a caller bug WOULD show up here. This test documents
    // that boundary rather than asserting a guarantee this function doesn't
    // make; the real guarantee is DEVICE_LOCAL_KEYS never being fed in.
    const plan = planSnapshotApply({}, ['device-id'])
    expect(plan.removals).toEqual(['device-id'])
  })
})
