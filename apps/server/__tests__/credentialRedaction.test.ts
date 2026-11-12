import { describe, it, expect } from 'vitest'
import { REDACTED, redactOpsForWorker, redactSecurityStoreBlob, redactSnapshotForWorker } from '../credentialRedaction'

const security = {
  adminUsername: 'owner',
  adminPasswordHash: 'pbkdf2$sha256$210000$c2FsdA==$aGFzaA==',
  workerUsername: 'budi',
  workerPasswordHash: 'pbkdf2$sha256$210000$c2FsdA==$d29ya2Vy',
  lanToken: 'ADMIN-TOKEN',
  workerLanToken: 'WORKER-TOKEN',
  adminRecoveryCodeHash: 'pbkdf2$sha256$210000$c2FsdA==$cmVjb3Zlcnk=',
  lanTokenRequired: true,
}
const blob = JSON.stringify({ state: { security }, version: 0 })

describe('redactSecurityStoreBlob', () => {
  it('replaces the admin token, admin hash and recovery hash with a placeholder', () => {
    const out = JSON.parse(redactSecurityStoreBlob(blob)).state.security
    expect(out.lanToken).toBe(REDACTED)
    expect(out.adminPasswordHash).toBe(REDACTED)
    expect(out.adminRecoveryCodeHash).toBe(REDACTED)
  })

  it('keeps what a worker device legitimately needs', () => {
    const out = JSON.parse(redactSecurityStoreBlob(blob)).state.security
    expect(out.workerLanToken).toBe('WORKER-TOKEN')
    expect(out.workerUsername).toBe('budi')
    expect(out.workerPasswordHash).toBe(security.workerPasswordHash)
    expect(out.adminUsername).toBe('owner')
    expect(out.lanTokenRequired).toBe(true)
  })

  it('leaves a null field null, so "no admin account yet" still reads as exactly that', () => {
    const fresh = JSON.stringify({ state: { security: { ...security, adminPasswordHash: null, lanToken: null } }, version: 0 })
    const out = JSON.parse(redactSecurityStoreBlob(fresh)).state.security
    expect(out.adminPasswordHash).toBeNull()
    expect(out.lanToken).toBeNull()
  })

  it('never lets the original secrets survive anywhere in the output', () => {
    const out = redactSecurityStoreBlob(blob)
    expect(out).not.toContain('ADMIN-TOKEN')
    expect(out).not.toContain(security.adminPasswordHash)
    expect(out).not.toContain(security.adminRecoveryCodeHash)
  })

  it('returns anything that is not a security-store envelope unchanged', () => {
    expect(redactSecurityStoreBlob('{not json')).toBe('{not json')
    expect(redactSecurityStoreBlob('{"state":{}}')).toBe('{"state":{}}')
  })
})

describe('redactSnapshotForWorker', () => {
  it('redacts only the security-store entry', () => {
    const out = redactSnapshotForWorker({ 'security-store': blob, 'customer-store': '{"state":{"customers":[]}}' })
    expect(out['customer-store']).toBe('{"state":{"customers":[]}}')
    expect(JSON.parse(out['security-store']).state.security.lanToken).toBe(REDACTED)
  })

  it('is a no-op when the snapshot has no security-store', () => {
    const data = { 'customer-store': '{}' }
    expect(redactSnapshotForWorker(data)).toBe(data)
  })
})

describe('redactOpsForWorker', () => {
  const op = (over: Record<string, unknown>) => ({
    seq: 1, id: 'o', device: 'd', entity: 'security-store', field: 'security', entityId: 'security-store',
    kind: 'upsert' as const, payload: JSON.stringify(security), ts: 't', ...over,
  })

  it('redacts a security-store upsert payload', () => {
    const [out] = redactOpsForWorker([op({})])
    expect(JSON.parse(out.payload).lanToken).toBe(REDACTED)
    expect(JSON.parse(out.payload).workerLanToken).toBe('WORKER-TOKEN')
  })

  it('does not touch other entities, and does not mutate its input', () => {
    const other = op({ entity: 'customer-store', field: 'customers', payload: '{"id":"c1"}' })
    const original = op({})
    const out = redactOpsForWorker([other, original])
    expect(out[0]).toBe(other)
    expect(original.payload).toContain('ADMIN-TOKEN')
  })

  it('passes a delete through (its payload is empty, not JSON)', () => {
    const del = op({ kind: 'delete', payload: '' })
    expect(redactOpsForWorker([del])[0]).toBe(del)
  })
})

// A worker tablet never shows the books (permissions.ts), so it is not sent them.
describe('business data hidden from a worker', () => {
  const store = (entity: string, state: Record<string, unknown>) => [entity, JSON.stringify({ state, version: 0 })] as const
  const snapshot = Object.fromEntries([
    store('expense-store', { expenses: [{ id: 'e1', amount: 5_000_000 }], categories: ['Rent'] }),
    store('supplier-store', { suppliers: [{ id: 's1', name: 'PT Sumber Oli' }] }),
    store('activity-log-store', { entries: [{ id: 'a1', what: 'x' }] }),
    store('inventory-store', { products: [{ id: 'p1', name: 'Oli', costPrice: 50_000, supplierCode: 'XK-77' }, { id: 'p2', name: 'Filter', supplierCode: '' }] }),
    store('customer-store', { customers: [{ id: 'c1' }] }),
  ])

  it('serves the expense list, suppliers and activity log empty', () => {
    const out = redactSnapshotForWorker(snapshot)
    expect(JSON.parse(out['expense-store']).state.expenses).toEqual([])
    expect(JSON.parse(out['supplier-store']).state.suppliers).toEqual([])
    expect(JSON.parse(out['activity-log-store']).state.entries).toEqual([])
  })

  it('keeps the rest of a hidden store, like the expense categories', () => {
    expect(JSON.parse(redactSnapshotForWorker(snapshot)['expense-store']).state.categories).toEqual(['Rent'])
  })

  it('blanks the supplier "modal" code on every product but leaves the till what it needs', () => {
    const products = JSON.parse(redactSnapshotForWorker(snapshot)['inventory-store']).state.products
    expect(products.map((p: { supplierCode: string }) => p.supplierCode)).toEqual(['', ''])
    // cost price feeds the cost of goods a tablet freezes onto each sale
    expect(products[0]).toMatchObject({ id: 'p1', name: 'Oli', costPrice: 50_000 })
  })

  it('leaves unrelated stores byte-for-byte alone', () => {
    expect(redactSnapshotForWorker(snapshot)['customer-store']).toBe(snapshot['customer-store'])
  })

  it('does not mutate the host\'s own snapshot', () => {
    const before = snapshot['expense-store']
    redactSnapshotForWorker(snapshot)
    expect(snapshot['expense-store']).toBe(before)
  })

  describe('in the ops feed', () => {
    const op = (over: Record<string, unknown>) => ({
      seq: 7, id: 'o', device: 'd', entity: 'expense-store', field: 'expenses', entityId: 'e1',
      kind: 'upsert' as const, payload: '{"id":"e1","amount":5000000}', ts: 't', ...over,
    })

    it('turns a hidden unit\'s upsert into a harmless delete, keeping its seq', () => {
      const [out] = redactOpsForWorker([op({}), ])
      expect(out).toMatchObject({ seq: 7, kind: 'delete', payload: '', entityId: 'e1' })
    })

    it.each([['supplier-store', 'suppliers'], ['activity-log-store', 'entries']])('does the same for %s', (entity, field) => {
      const [out] = redactOpsForWorker([op({ entity, field, kind: 'append' })])
      expect(out.kind).toBe('delete')
      expect(out.payload).toBe('')
    })

    it('blanks supplierCode inside a product upsert', () => {
      const [out] = redactOpsForWorker([op({ entity: 'inventory-store', field: 'products', payload: '{"id":"p1","costPrice":50000,"supplierCode":"XK-77"}' })])
      expect(JSON.parse(out.payload)).toEqual({ id: 'p1', costPrice: 50_000, supplierCode: '' })
      expect(out.kind).toBe('upsert')
    })

    it('does not touch the expense categories singleton', () => {
      const categories = op({ field: 'categories', entityId: 'expense-store', payload: '["Rent"]' })
      expect(redactOpsForWorker([categories])[0]).toBe(categories)
    })
  })
})
