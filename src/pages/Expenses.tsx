import { useState } from 'react'
import { useExpenseStore, Expense, EXPENSE_CATEGORIES } from '../store/expenseStore'
import { formatCurrency } from '../lib/currency'
import { DropdownMenu } from '../components/ui/DropdownMenu'
import { Pencil, Trash2 } from 'lucide-react'

export default function Expenses() {
  const { expenses, addExpense, updateExpense, deleteExpense } = useExpenseStore()
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)
  const [filterCategory, setFilterCategory] = useState('')
  const [filterMonth, setFilterMonth] = useState('')

  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0])
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [vendor, setVendor] = useState('')
  const [notes, setNotes] = useState('')

  let filtered = [...expenses]
  if (filterCategory) {
    filtered = filtered.filter(e => e.category === filterCategory)
  }
  if (filterMonth) {
    filtered = filtered.filter(e => e.date.startsWith(filterMonth))
  }
  filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const totalFiltered = filtered.reduce((sum, e) => sum + e.amount, 0)
  const months = [...new Set(expenses.map(e => e.date.slice(0, 7)))].sort().reverse()

  const resetForm = () => {
    setDate(new Date().toISOString().split('T')[0])
    setCategory(EXPENSE_CATEGORIES[0])
    setDescription('')
    setAmount('')
    setVendor('')
    setNotes('')
    setEditing(null)
  }

  const openCreate = () => {
    resetForm()
    setShowModal(true)
  }

  const openEdit = (e: Expense) => {
    setEditing(e)
    setDate(e.date)
    setCategory(e.category)
    setDescription(e.description)
    setAmount(e.amount.toString())
    setVendor(e.vendor)
    setNotes(e.notes)
    setShowModal(true)
  }

  const handleSave = () => {
    if (!description.trim()) return alert('Description is required')
    if (!amount) return alert('Amount is required')

    const data = {
      date,
      category,
      description,
      amount: Math.round(parseFloat(amount) || 0),
      vendor,
      notes,
    }

    if (editing) {
      updateExpense(editing.id, data)
    } else {
      addExpense(data)
    }
    setShowModal(false)
    resetForm()
  }

  const handleDelete = (id: string) => {
    if (confirm('Delete this expense?')) {
      deleteExpense(id)
    }
  }

  const inputClass = "w-full px-3 py-2 bg-surface-sunken border border-border-subtle rounded-tile text-text-primary focus:outline-none focus:border-accent-mint"

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-page-title text-text-primary">Expenses</h1>
        <button
          onClick={openCreate}
          className="bg-accent-mint text-surface-canvas px-4 py-2 rounded-tile hover:opacity-90 transition-opacity font-medium"
        >
          + Add Expense
        </button>
      </div>

      <div className="bg-surface-card rounded-card p-4 mb-6">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-caption">
              {filterCategory || filterMonth ? 'Filtered Total' : 'All Time Total'}
            </p>
            <p className="text-kpi text-text-primary">{formatCurrency(totalFiltered)}</p>
          </div>
          <p className="text-text-secondary">{filtered.length} expense{filtered.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 mb-4">
        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
          className="px-4 py-2 bg-surface-sunken border border-border-subtle rounded-tile text-text-primary focus:outline-none focus:border-accent-mint"
        >
          <option value="">All Categories</option>
          {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={filterMonth}
          onChange={e => setFilterMonth(e.target.value)}
          className="px-4 py-2 bg-surface-sunken border border-border-subtle rounded-tile text-text-primary focus:outline-none focus:border-accent-mint"
        >
          <option value="">All Time</option>
          {months.map(m => (
            <option key={m} value={m}>
              {new Date(m + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-surface-card rounded-card p-8 text-center text-text-secondary">
          {filterCategory || filterMonth ? 'No expenses found matching your filters.' : 'No expenses yet. Add your first one.'}
        </div>
      ) : (
        <div className="bg-surface-card rounded-card overflow-hidden">
          <table className="w-full">
            <thead className="bg-surface-sunken border-b border-border-subtle">
              <tr>
                <th className="text-left p-3 font-medium text-text-secondary">Date</th>
                <th className="text-left p-3 font-medium text-text-secondary">Category</th>
                <th className="text-left p-3 font-medium text-text-secondary">Description</th>
                <th className="text-left p-3 font-medium text-text-secondary">Vendor</th>
                <th className="text-right p-3 font-medium text-text-secondary">Amount</th>
                <th className="text-left p-3 font-medium text-text-secondary">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => (
                <tr key={e.id} className="border-t border-border-subtle hover:bg-surface-sunken">
                  <td className="p-3 text-sm text-text-secondary tabular-nums">{new Date(e.date).toLocaleDateString()}</td>
                  <td className="p-3">
                    <span className="px-2 py-1 bg-surface-sunken rounded-tile text-sm text-text-secondary">{e.category}</span>
                  </td>
                  <td className="p-3 text-text-primary">{e.description}</td>
                  <td className="p-3 text-text-secondary">{e.vendor || '-'}</td>
                  <td className="p-3 text-right font-medium text-text-primary tabular-nums">{formatCurrency(e.amount)}</td>
                  <td className="p-3">
                    <DropdownMenu
                      items={[
                        { label: 'Edit', icon: Pencil, onClick: () => openEdit(e) },
                        { label: 'Delete', icon: Trash2, onClick: () => handleDelete(e.id), variant: 'danger' },
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
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-surface-card rounded-card p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold text-text-primary mb-4">
              {editing ? 'Edit Expense' : 'Add Expense'}
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Date *</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Amount *</label>
                  <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className={`${inputClass} tabular-nums`} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Category</label>
                <select value={category} onChange={e => setCategory(e.target.value)} className={inputClass}>
                  {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Description *</label>
                <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g., Monthly oil inventory restock" className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Vendor</label>
                <input type="text" value={vendor} onChange={e => setVendor(e.target.value)} placeholder="e.g., AutoZone, O'Reilly" className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={inputClass} />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setShowModal(false); resetForm() }} className="flex-1 px-4 py-2 border border-border-subtle rounded-tile text-text-secondary hover:text-text-primary">
                Cancel
              </button>
              <button onClick={handleSave} className="flex-1 px-4 py-2 bg-accent-mint text-surface-canvas rounded-tile hover:opacity-90 font-medium">
                {editing ? 'Save Changes' : 'Add Expense'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
