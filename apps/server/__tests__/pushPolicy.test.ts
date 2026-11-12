import { describe, it, expect } from 'vitest'
import { planPush, type PushLookups } from '../pushPolicy'
import type { OpRow } from '../db'

const NOW = new Date('2026-08-10T09:00:00.000Z')

function op(overrides: Partial<OpRow> = {}): OpRow {
  return {
    id: 'op-1',
    device: 'tablet',
    entity: 'work-order-store',
    field: 'workOrders',
    entityId: 'wo-1',
    kind: 'upsert',
    payload: JSON.stringify({ id: 'wo-1', status: 'open' }),
    ts: '2026-08-10T08:00:00.000Z',
    ...overrides,
  }
}

/** A host with nothing on it unless a test says otherwise. */
function lookups(overrides: Partial<PushLookups> = {}): PushLookups {
  return {
    stored: () => null,
    isDeleted: () => false,
    currentRow: () => null,
    ...overrides,
  }
}

const completedRow = { id: 'wo-1', status: 'completed', total: 160_000 }
const hostWithCompletedOrder = lookups({ currentRow: () => completedRow })

describe('planPush — ordinary ops', () => {
  it('accepts a fresh op', () => {
    expect(planPush([op()], lookups(), NOW).actions).toEqual([{ kind: 'insert' }])
  })

  it('accepts a delete', () => {
    expect(planPush([op({ kind: 'delete', payload: '' })], lookups(), NOW).actions).toEqual([{ kind: 'insert' }])
  })
})

describe('planPush — retried and clashing op ids', () => {
  it('recognises a retry of an op the host already holds, and applies nothing', () => {
    const plan = planPush([op()], lookups({ stored: () => op() }), NOW)
    expect(plan.actions).toEqual([{ kind: 'duplicate', existingId: 'op-1' }])
    expect(plan.conflicts).toEqual([])
  })

  it('a retry does not care that the clock stamp differs', () => {
    const plan = planPush([op({ ts: '2026-08-10T08:00:09.000Z' })], lookups({ stored: () => op() }), NOW)
    expect(plan.conflicts).toEqual([])
  })

  it('flags an id already used by a DIFFERENT op', () => {
    const stored = op({ payload: JSON.stringify({ id: 'wo-1', status: 'completed' }) })
    const plan = planPush([op()], lookups({ stored: () => stored }), NOW)
    expect(plan.conflicts).toEqual([0])
  })
})

describe('planPush — deleted rows stay deleted', () => {
  const deletedHost = lookups({ isDeleted: () => true })

  it('refuses an upsert for a deleted work order and answers with a delete', () => {
    const [action] = planPush([op({ id: 'op-9' })], deletedHost, NOW).actions
    expect(action).toMatchObject({ kind: 'drop', reason: 'deleted-row' })
    if (action.kind === 'drop') {
      expect(action.corrective).toMatchObject({
        id: 'fix:op-9',
        device: 'server',
        entity: 'work-order-store',
        entityId: 'wo-1',
        kind: 'delete',
        payload: '',
        ts: NOW.toISOString(),
      })
    }
  })

  it('protects vehicles, customers, companies, expenses and appointments the same way', () => {
    const units: [string, string][] = [
      ['vehicle-store', 'vehicles'],
      ['customer-store', 'customers'],
      ['company-store', 'companies'],
      ['expense-store', 'expenses'],
      ['appointment-storage', 'appointments'],
    ]
    for (const [entity, field] of units) {
      const [action] = planPush([op({ entity, field })], deletedHost, NOW).actions
      expect(action.kind, `${entity}/${field}`).toBe('drop')
    }
  })

  it('leaves units with reusable ids alone — a bay can be created again with its old id', () => {
    const [action] = planPush([op({ entity: 'bay-storage', field: 'bays', entityId: '1' })], deletedHost, NOW).actions
    expect(action).toEqual({ kind: 'insert' })
  })

  it('refuses an upsert that follows a delete in the SAME batch', () => {
    const plan = planPush(
      [op({ id: 'a', kind: 'delete', payload: '' }), op({ id: 'b' })],
      lookups(),
      NOW
    )
    expect(plan.actions[0]).toEqual({ kind: 'insert' })
    expect(plan.actions[1]).toMatchObject({ kind: 'drop', reason: 'deleted-row' })
  })

  it('does not mistake a delete of one row for another', () => {
    const plan = planPush(
      [op({ id: 'a', entityId: 'wo-1', kind: 'delete', payload: '' }), op({ id: 'b', entityId: 'wo-2' })],
      lookups(),
      NOW
    )
    expect(plan.actions[1]).toEqual({ kind: 'insert' })
  })
})

describe('planPush — a work order only moves forward', () => {
  const upsertWith = (status: string, id = 'op-1') => op({ id, payload: JSON.stringify({ id: 'wo-1', status, total: 1 }) })

  it('refuses to reopen a completed order, and answers with the completed row', () => {
    const [action] = planPush([upsertWith('open')], hostWithCompletedOrder, NOW).actions
    expect(action).toMatchObject({ kind: 'drop', reason: 'status-regression' })
    if (action.kind === 'drop') {
      expect(action.corrective.kind).toBe('upsert')
      expect(JSON.parse(action.corrective.payload)).toEqual(completedRow)
    }
  })

  it('refuses to un-void a cancelled order', () => {
    const host = lookups({ currentRow: () => ({ id: 'wo-1', status: 'cancelled' }) })
    expect(planPush([upsertWith('completed')], host, NOW).actions[0].kind).toBe('drop')
    expect(planPush([upsertWith('open')], host, NOW).actions[0].kind).toBe('drop')
  })

  it('lets an order move forward: open → completed → cancelled', () => {
    const open = lookups({ currentRow: () => ({ id: 'wo-1', status: 'open' }) })
    expect(planPush([upsertWith('completed')], open, NOW).actions[0]).toEqual({ kind: 'insert' })
    expect(planPush([upsertWith('cancelled')], hostWithCompletedOrder, NOW).actions[0]).toEqual({ kind: 'insert' })
  })

  it('lets a completed order be edited without changing status — recording a payment', () => {
    expect(planPush([upsertWith('completed')], hostWithCompletedOrder, NOW).actions[0]).toEqual({ kind: 'insert' })
  })

  it('accepts an order the host has never seen, whatever its status', () => {
    expect(planPush([upsertWith('completed')], lookups(), NOW).actions[0]).toEqual({ kind: 'insert' })
  })

  it('judges later ops in a batch against earlier ones in it', () => {
    const plan = planPush([upsertWith('completed', 'a'), upsertWith('open', 'b')], lookups(), NOW)
    expect(plan.actions[0]).toEqual({ kind: 'insert' })
    const second = plan.actions[1]
    expect(second).toMatchObject({ kind: 'drop', reason: 'status-regression' })
    if (second.kind === 'drop') expect(JSON.parse(second.corrective.payload).status).toBe('completed')
  })

  it('does not touch other stores, or an unknown status', () => {
    const odd = op({ payload: JSON.stringify({ id: 'wo-1', status: 'on-hold' }) })
    expect(planPush([odd], hostWithCompletedOrder, NOW).actions[0]).toEqual({ kind: 'insert' })
    const vehicle = op({ entity: 'vehicle-store', field: 'vehicles', payload: JSON.stringify({ id: 'wo-1', status: 'open' }) })
    expect(planPush([vehicle], hostWithCompletedOrder, NOW).actions[0]).toEqual({ kind: 'insert' })
  })
})
