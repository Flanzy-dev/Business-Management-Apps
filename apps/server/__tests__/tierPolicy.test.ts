import { describe, expect, it } from 'vitest'
import { validateWorkerBatch, workerCorrectives } from '../tierPolicy'
import type { OpRow } from '../db'

function op(overrides: Partial<OpRow> = {}): OpRow {
  return {
    id: 'op-1', device: 'tablet', entity: 'work-order-store', field: 'workOrders',
    entityId: 'wo-1', kind: 'upsert', payload: JSON.stringify({ id: 'wo-1', status: 'open' }),
    ts: '2026-11-03T00:00:00.000Z', ...overrides,
  }
}

const lookups = (row: Record<string, unknown> | null = null) => ({ currentRow: () => row })
const del = (overrides: Partial<OpRow> = {}) => op({ kind: 'delete', payload: '', ...overrides })

describe('validateWorkerBatch — work orders', () => {
  it('allows creating and completing an open work order', () => {
    expect(validateWorkerBatch([op()], lookups())).toEqual([])
    expect(validateWorkerBatch([op({ payload: JSON.stringify({ id: 'wo-1', status: 'completed' }) })], lookups({ status: 'open' }))).toEqual([])
  })

  it('refuses rewrites of already-booked orders and worker voids', () => {
    expect(validateWorkerBatch([op()], lookups({ status: 'completed' }))[0].reason).toContain('booked')
    expect(validateWorkerBatch([op({ payload: JSON.stringify({ status: 'cancelled' }) })], lookups({ status: 'open' }))[0].reason).toContain('void')
  })

  it('refuses to touch a voided order', () => {
    expect(validateWorkerBatch([op()], lookups({ status: 'cancelled' }))).toHaveLength(1)
  })

  describe('collecting a customer\'s debt', () => {
    const unpaid = { id: 'wo-1', status: 'completed', paymentMethod: 'pending', total: 160_000, items: [{ id: 'i', quantity: 2 }] }
    const settle = (changes: Record<string, unknown>) => op({ payload: JSON.stringify({ ...unpaid, ...changes }) })

    it('is allowed: only the payment fields change', () => {
      const paid = settle({ paymentMethod: 'cash', amountReceived: 160_000, paidAt: '2026-11-03T08:00:00.000Z' })
      expect(validateWorkerBatch([paid], lookups(unpaid))).toEqual([])
    })

    it('is refused when anything else about the sale changes with it', () => {
      expect(validateWorkerBatch([settle({ paymentMethod: 'cash', total: 1 })], lookups(unpaid))).toHaveLength(1)
      expect(validateWorkerBatch([settle({ paymentMethod: 'cash', items: [] })], lookups(unpaid))).toHaveLength(1)
    })

    it('is refused for an order that was already paid — no re-writing how it was settled', () => {
      const alreadyPaid = { ...unpaid, paymentMethod: 'cash' }
      expect(validateWorkerBatch([settle({ paymentMethod: 'qris' })], lookups(alreadyPaid))).toHaveLength(1)
    })

    it('cannot be used to void', () => {
      expect(validateWorkerBatch([settle({ status: 'cancelled' })], lookups(unpaid))).toHaveLength(1)
    })
  })
})

describe('validateWorkerBatch — deletes', () => {
  it('lets a worker delete an order that was never booked — the counter does this', () => {
    expect(validateWorkerBatch([del()], lookups({ status: 'open' }))).toEqual([])
    expect(validateWorkerBatch([del()], lookups(null))).toEqual([])
  })

  it('refuses deleting a completed or voided order', () => {
    expect(validateWorkerBatch([del()], lookups({ status: 'completed' }))[0].reason).toContain('booked')
    expect(validateWorkerBatch([del()], lookups({ status: 'cancelled' }))[0].reason).toContain('booked')
  })

  it('lets a worker cancel an appointment or clear a reminder follow-up', () => {
    expect(validateWorkerBatch([del({ entity: 'appointment-storage', field: 'appointments' })], lookups())).toEqual([])
    expect(validateWorkerBatch([del({ entity: 'reminder-follow-up-store', field: 'followUps' })], lookups())).toEqual([])
  })

  it.each([
    ['customer-store', 'customers'],
    ['vehicle-store', 'vehicles'],
    ['bay-storage', 'bays'],
    ['worker-store', 'workers'],
  ])('refuses deleting a row of %s', (entity, field) => {
    expect(validateWorkerBatch([del({ entity, field })], lookups())[0].reason).toContain('delete')
  })
})

describe('validateWorkerBatch — admin-only stores', () => {
  it.each(['expense-store', 'settings-store', 'supplier-store', 'inventory-store'])('keeps %s admin-only', (entity) => {
    expect(validateWorkerBatch([op({ entity, field: 'items' })], lookups())).toHaveLength(1)
  })

  it('still allows append-only stock rows needed by worker checkout and receiving', () => {
    expect(validateWorkerBatch([op({ entity: 'stock-movement-store', field: 'movements' })], lookups())).toEqual([])
    expect(validateWorkerBatch([op({ entity: 'stock-lot-store', field: 'stockLots' })], lookups())).toEqual([])
  })

  it('reports every refused op by its index, leaving the allowed ones out', () => {
    const rejected = validateWorkerBatch([op({ id: 'a' }), op({ id: 'b', entity: 'expense-store', field: 'expenses' }), op({ id: 'c' })], lookups())
    expect(rejected.map((r) => r.index)).toEqual([1])
  })
})

describe('workerCorrectives', () => {
  const NOW = new Date('2026-11-03T09:00:00.000Z')

  it('answers a refused edit with the row as the host really has it', () => {
    const current = { id: 'wo-1', status: 'completed' }
    const ops = [op({ id: 'stale' })]
    const rejected = validateWorkerBatch(ops, lookups(current))
    const [fix] = workerCorrectives(ops, rejected, lookups(current), NOW)
    expect(fix).toMatchObject({ id: 'fix:stale', device: 'server', kind: 'upsert', entityId: 'wo-1', ts: NOW.toISOString() })
    expect(JSON.parse(fix.payload)).toEqual(current)
  })

  it('restores a row the tablet tried to delete', () => {
    const current = { id: 'wo-1', status: 'completed' }
    const ops = [del({ id: 'gone' })]
    const [fix] = workerCorrectives(ops, validateWorkerBatch(ops, lookups(current)), lookups(current), NOW)
    expect(fix.kind).toBe('upsert')
  })

  it('has nothing to say about a row the host does not hold', () => {
    const ops = [op({ entity: 'expense-store', field: 'expenses' })]
    expect(workerCorrectives(ops, validateWorkerBatch(ops, lookups(null)), lookups(null), NOW)).toEqual([])
  })
})
