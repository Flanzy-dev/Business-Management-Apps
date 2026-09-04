// Suppliers.tsx's add/edit form state, pulled out of the page body — same
// shape as every other *Form.ts module in this codebase.
import type { Supplier } from '../store/supplierStore'

export interface SupplierDraft {
  name: string
  phone: string
  email: string
  address: string
  notes: string
}

export function initialSupplierDraft(): SupplierDraft {
  return { name: '', phone: '', email: '', address: '', notes: '' }
}

export function supplierDraftFrom(s: Supplier): SupplierDraft {
  return { name: s.name, phone: s.phone, email: s.email, address: s.address, notes: s.notes }
}

/** The only rule: a supplier needs a name. */
export function validateSupplierDraft(draft: SupplierDraft): { ok: boolean } {
  return { ok: draft.name.trim().length > 0 }
}
