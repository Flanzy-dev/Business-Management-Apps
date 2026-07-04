import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useCustomerStore, Customer } from '../store/customerStore'
import { DropdownMenu } from '../components/ui/DropdownMenu'
import { Pencil, Trash2 } from 'lucide-react'

export default function Customers() {
  const { customers, addCustomer, updateCustomer, deleteCustomer } = useCustomerStore()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [returnToOrder, setReturnToOrder] = useState(false)

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      c.email.toLowerCase().includes(search.toLowerCase())
  )

  const handleAdd = () => {
    setEditingCustomer(null)
    setIsModalOpen(true)
  }

  // Auto-open the add form when arriving via ?new=1 (e.g. from the new-order dialog).
  useEffect(() => {
    if (searchParams.get('new')) {
      setReturnToOrder(searchParams.get('fromOrder') === '1')
      handleAdd()
      setSearchParams({}, { replace: true })
    }
  }, [searchParams])

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer)
    setIsModalOpen(true)
  }

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this customer?')) {
      deleteCustomer(id)
    }
  }

  const handleSave = (data: Omit<Customer, 'id' | 'createdAt'>) => {
    if (editingCustomer) {
      updateCustomer(editingCustomer.id, data)
    } else {
      const created = addCustomer(data)
      if (returnToOrder) {
        setReturnToOrder(false)
        setIsModalOpen(false)
        navigate(`/work-orders?new=1&ownerType=customer&ownerId=${created.id}`)
        return
      }
    }
    setIsModalOpen(false)
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-page-title text-text-primary">Customers</h1>
        <button
          onClick={handleAdd}
          className="bg-accent text-surface-canvas px-4 py-2 rounded-radius-sm hover:opacity-90 transition-opacity font-medium"
        >
          + Add Customer
        </button>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name, phone, or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md px-4 py-2 bg-surface-sunken border border-border-subtle rounded-radius-sm text-text-primary placeholder-text-secondary focus:outline-none focus:border-accent"
        />
      </div>

      <div className="bg-surface-card rounded-radius-md overflow-hidden">
        <table className="w-full">
          <thead className="bg-surface-sunken border-b border-border-subtle">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-semibold text-text-secondary">Name</th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-text-secondary">Phone</th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-text-secondary">Email</th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-text-secondary">Address</th>
              <th className="text-right px-4 py-3 text-sm font-semibold text-text-secondary">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredCustomers.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-text-secondary">
                  {customers.length === 0
                    ? 'No customers yet. Add your first customer to get started.'
                    : 'No customers match your search.'}
                </td>
              </tr>
            ) : (
              filteredCustomers.map((customer) => (
                <tr key={customer.id} className="border-b border-border-subtle hover:bg-surface-sunken">
                  <td className="px-4 py-3 font-medium text-text-primary">{customer.name}</td>
                  <td className="px-4 py-3 text-text-secondary">{customer.phone}</td>
                  <td className="px-4 py-3 text-text-secondary">{customer.email}</td>
                  <td className="px-4 py-3 text-text-secondary">{customer.address}</td>
                  <td className="px-4 py-3 text-right">
                    <DropdownMenu
                      items={[
                        { label: 'Edit', icon: Pencil, onClick: () => handleEdit(customer) },
                        { label: 'Delete', icon: Trash2, onClick: () => handleDelete(customer.id), variant: 'danger' },
                      ]}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <CustomerModal
          customer={editingCustomer}
          onSave={handleSave}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  )
}

function CustomerModal({
  customer,
  onSave,
  onClose,
}: {
  customer: Customer | null
  onSave: (data: Omit<Customer, 'id' | 'createdAt'>) => void
  onClose: () => void
}) {
  const [name, setName] = useState(customer?.name ?? '')
  const [phone, setPhone] = useState(customer?.phone ?? '')
  const [email, setEmail] = useState(customer?.email ?? '')
  const [address, setAddress] = useState(customer?.address ?? '')
  const [notes, setNotes] = useState(customer?.notes ?? '')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    onSave({ name, phone, email, address, notes })
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 backdrop-blur-[8px]" style={{ backgroundColor: 'var(--overlay-scrim)' }}>
      <div className="bg-surface-card rounded-radius-md w-full max-w-md p-6">
        <h2 className="text-xl font-bold text-text-primary mb-4">
          {customer ? 'Edit Customer' : 'Add Customer'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-surface-sunken border border-border-subtle rounded-radius-sm text-text-primary focus:outline-none focus:border-accent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Phone
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 bg-surface-sunken border border-border-subtle rounded-radius-sm text-text-primary focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-surface-sunken border border-border-subtle rounded-radius-sm text-text-primary focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Address
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3 py-2 bg-surface-sunken border border-border-subtle rounded-radius-sm text-text-primary focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 bg-surface-sunken border border-border-subtle rounded-radius-sm text-text-primary focus:outline-none focus:border-accent"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-text-secondary hover:text-text-primary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-accent text-surface-canvas px-4 py-2 rounded-radius-sm hover:opacity-90 transition-opacity font-medium"
            >
              {customer ? 'Save Changes' : 'Add Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
