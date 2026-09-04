// Tests the store-writing runner (src/lib/ops/stockLedgerBackfill.ts), not the
// pure decisions (src/lib/__tests__/stockLedgerBackfill.test.ts, which tests
// src/lib/stockLedgerBackfill.ts directly). Same rationale as
// costingBackfillOps.test.ts: this runner used to reach useXStore.getState()
// singletons directly and had no tests, and the property that matters most
// for a migration that runs once against real user data is that a second run
// is a true no-op.
import { describe, it, expect } from 'vitest'
import { createStockLedgerBackfillOps } from '../ops/stockLedgerBackfill'
import { buildFakeOpsDeps } from './helpers/fakeOpsDeps'
import { qtyOnHand } from '../stockLedger'

describe('stockLedgerBackfill ops runner', () => {
  it('opens a lot and records an opening movement for legacy stock with no lot at all', () => {
    const world = buildFakeOpsDeps({
      products: [{ id: 'p-1', costPrice: 40_000, createdAt: '2026-01-01T00:00:00.000Z', qtyOnHand: 6 } as never],
    })
    const { runStockLedgerBackfill } = createStockLedgerBackfillOps(world.deps)

    runStockLedgerBackfill()

    expect(world.stockLots.stockLots).toHaveLength(1)
    expect(qtyOnHand(world.movements.movements, 'p-1')).toBe(6)
    expect(world.movements.ledgerBackfilledAt).toBeTruthy()
    // Attribution flows from deps, same as every other ops-written movement.
    expect(world.movements.movements[0].deviceId).toBe('test-device')
    expect(world.movements.movements[0].mode).toBe('admin')
  })

  it('is a no-op on a second run', () => {
    const world = buildFakeOpsDeps({
      products: [{ id: 'p-1', costPrice: 40_000, createdAt: '2026-01-01T00:00:00.000Z', qtyOnHand: 6 } as never],
    })
    const { runStockLedgerBackfill } = createStockLedgerBackfillOps(world.deps)

    runStockLedgerBackfill()
    const countAfterFirst = world.movements.movements.length

    runStockLedgerBackfill()

    expect(world.movements.movements).toHaveLength(countAfterFirst)
  })

  it('does nothing when ledgerBackfilledAt is already set', () => {
    const world = buildFakeOpsDeps({
      products: [{ id: 'p-1', costPrice: 40_000, createdAt: '2026-01-01T00:00:00.000Z', qtyOnHand: 6 } as never],
      ledgerBackfilledAt: '2026-01-01T00:00:00.000Z',
    })
    const { runStockLedgerBackfill } = createStockLedgerBackfillOps(world.deps)

    runStockLedgerBackfill()

    expect(world.movements.movements).toHaveLength(0)
    expect(world.stockLots.stockLots).toHaveLength(0)
  })

  it('is a harmless no-op on a fresh install with nothing to backfill', () => {
    const world = buildFakeOpsDeps()
    const { runStockLedgerBackfill } = createStockLedgerBackfillOps(world.deps)

    expect(() => runStockLedgerBackfill()).not.toThrow()
    expect(world.movements.ledgerBackfilledAt).toBeTruthy()
  })
})
