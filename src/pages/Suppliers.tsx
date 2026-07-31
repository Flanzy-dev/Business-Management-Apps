import { useState } from 'react'
import { useSupplierStore, Supplier } from '../store/supplierStore'
import { useToastStore } from '../store/toastStore'
import { deleteSupplierDetaching } from '../lib/ops/entityOps'
import { DropdownMenu } from '../components/ui/DropdownMenu'
import { Pencil, Trash2 } from 'lucide-react'

export default function Suppliers() {
  const { suppliers, addSupplier, updateSupplier } = useSupplierStore()
  const showToast = useToastStore((s) => s.show)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [search, setSearch] = useState('')

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.phone.includes(search)
  )

  const resetForm = () => {
    setName('')
    setPhone('')
    setEmail('')
    setAddress('')
    setNotes('')
    setEditing(null)
  }

  const openCreate = () => {
    resetForm()
    setShowModal(true)
  }

  const openEdit = (s: Supplier) => {
    setEditing(s)
    setName(s.name)
    setPhone(s.phone)
    setEmail(s.email)
    setAddress(s.address)
    setNotes(s.notes)
    setShowModal(true)
  }

  const handleSave = () => {
    if (!name.trim()) return alert('Name is required')

    if (editing) {
      updateSupplier(editing.id, { name, phone, email, address, notes })
    } else {
      addSupplier({ name, phone, email, address, notes })
    }
    setShowModal(false)
    resetForm()
  }

  const handleDelete = (id: string) => {
    if (!confirm('Delete this supplier? Products from this supplier are kept and unlinked.')) return
    const { detachedProducts } = deleteSupplierDetaching(id)
    if (detachedProducts > 0) {
      showToast({
        tone: 'neutral',
        title: 'Supplier deleted',
        description: `${detachedProducts} product${detachedProducts === 1 ? '' : 's'} unlinked from this supplier.`,
      })
    }
  }

  const inputClass = "w-full px-3 py-2 bg-surface-sunken border border-border-subtle rounded-radius-sm text-text-primary focus:outline-none focus:border-accent"

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-page-title text-text-primary">Suppliers</h1>
        <button
          onClick={openCreate}
          className="bg-accent text-surface-canvas px-4 py-2 rounded-radius-sm hover:opacity-90 transition-opacity font-medium"
        >
          + Add Supplier
        </button>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name or phone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full md:w-80 px-4 py-2 bg-surface-sunken border border-border-subtle rounded-radius-sm text-text-primary placeholder-text-secondary focus:outline-none focus:border-accent"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-surface-card rounded-radius-md p-8 text-center text-text-secondary">
          {search ? 'No suppliers found matching your search.' : 'No suppliers yet. Add your first one.'}
        </div>
      ) : (
        <div className="bg-surface-card rounded-radius-md overflow-hidden">
          <table className="w-full">
            <thead className="bg-surface-sunken border-b border-border-subtle">
              <tr>
                <th className="text-left p-3 font-medium text-text-secondary">Name</th>
                <th className="text-left p-3 font-medium text-text-secondary">Phone</th>
                <th className="text-left p-3 font-medium text-text-secondary">Email</th>
                <th className="text-left p-3 font-medium text-text-secondary">Address</th>
                <th className="text-left p-3 font-medium text-text-secondary">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} className="border-t border-border-subtle hover:bg-surface-sunken">
                  <td className="p-3 font-medium text-text-primary">{s.name}</td>
                  <td className="p-3 text-text-secondary">{s.phone || '-'}</td>
                  <td className="p-3 text-text-secondary">{s.email || '-'}</td>
                  <td className="p-3 text-sm text-text-secondary">{s.address || '-'}</td>
                  <td className="p-3">
                    <DropdownMenu
                      items={[
                        { label: 'Edit', icon: Pencil, onClick: () => openEdit(s) },
                        { label: 'Delete', icon: Trash2, onClick: () => handleDelete(s.id), variant: 'danger' },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 backdrop-blur-[8px]" style={{ backgroundColor: 'var(--overlay-scrim)' }}>
          <div className="bg-surface-card rounded-radius-md p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold text-text-primary mb-4">
              {editing ? 'Edit Supplier' : 'Add Supplier'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Name *</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Phone</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Address</label>
                <input type="text" value={address} onChange={e => setAddress(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={inputClass} />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setShowModal(false); resetForm() }} className="flex-1 px-4 py-2 border border-border-subtle rounded-radius-sm text-text-secondary hover:text-text-primary">
                Cancel
              </button>
              <button onClick={handleSave} className="flex-1 px-4 py-2 bg-accent text-surface-canvas rounded-radius-sm hover:opacity-90 font-medium">
                {editing ? 'Save Changes' : 'Add Supplier'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
