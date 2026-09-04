import { describe, it, expect } from 'vitest'
import { initialSupplierDraft, supplierDraftFrom, validateSupplierDraft } from '../supplierForm'
import type { Supplier } from '../../store/supplierStore'

function supplier(overrides: Partial<Supplier> = {}): Supplier {
  return { id: 's-1', name: 'Acme', phone: '0812', email: 'a@b.com', address: 'Jl. Merdeka', notes: 'net 30', createdAt: '', ...overrides }
}

describe('initialSupplierDraft', () => {
  it('is entirely blank', () => {
    expect(initialSupplierDraft()).toEqual({ name: '', phone: '', email: '', address: '', notes: '' })
  })
})

describe('supplierDraftFrom', () => {
  it('carries every editable field over from the supplier', () => {
    expect(supplierDraftFrom(supplier())).toEqual({
      name: 'Acme',
      phone: '0812',
      email: 'a@b.com',
      address: 'Jl. Merdeka',
      notes: 'net 30',
    })
  })
})

describe('validateSupplierDraft', () => {
  it('rejects a blank name', () => {
    expect(validateSupplierDraft(initialSupplierDraft())).toEqual({ ok: false })
  })

  it('rejects a whitespace-only name', () => {
    expect(validateSupplierDraft({ ...initialSupplierDraft(), name: '   ' })).toEqual({ ok: false })
  })

  it('accepts a name with nothing else filled in', () => {
    expect(validateSupplierDraft({ ...initialSupplierDraft(), name: 'Acme' })).toEqual({ ok: true })
  })
})
