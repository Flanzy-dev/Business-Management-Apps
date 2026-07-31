import { useState } from 'react'
import { useWorkerStore, Worker } from '../store/workerStore'
import { useToastStore } from '../store/toastStore'
import { deleteWorkerChecked } from '../lib/ops/entityOps'
import { DropdownMenu } from '../components/ui/DropdownMenu'
import { Pencil, Trash2, Power } from 'lucide-react'

export default function Technicians() {
  const { workers, addWorker, updateWorker } = useWorkerStore()
  const showToast = useToastStore((s) => s.show)
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null)
  const [viewingWorker, setViewingWorker] = useState<Worker | null>(null)

  const filteredWorkers = workers.filter((w) => {
    const matchesSearch =
      w.name.toLowerCase().includes(search.toLowerCase()) ||
      w.phone.includes(search) ||
      w.employeeId.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = showInactive ? true : w.isActive
    return matchesSearch && matchesStatus
  })

  const handleAdd = () => {
    setEditingWorker(null)
    setIsModalOpen(true)
  }

  const handleEdit = (worker: Worker) => {
    setEditingWorker(worker)
    setIsModalOpen(true)
  }

  const handleDelete = (id: string) => {
    if (!confirm('Are you sure you want to delete this technician?')) return
    const result = deleteWorkerChecked(id)
    if (!result.ok) {
      showToast({ tone: 'warning', title: 'Cannot delete technician', description: result.reason })
    }
  }

  const handleToggleActive = (worker: Worker) => {
    updateWorker(worker.id, { isActive: !worker.isActive })
  }

  const handleSave = (data: Omit<Worker, 'id' | 'createdAt'>) => {
    if (editingWorker) {
      updateWorker(editingWorker.id, data)
    } else {
      addWorker(data)
    }
    setIsModalOpen(false)
  }

  const activeCount = workers.filter((w) => w.isActive).length

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-page-title text-text-primary">Technicians</h1>
          <p className="text-caption">{activeCount} active technician(s)</p>
        </div>
        <button
          onClick={handleAdd}
          className="bg-accent text-surface-canvas px-4 py-2 rounded-radius-sm hover:opacity-90 transition-opacity font-medium"
        >
          + Add Technician
        </button>
      </div>

      <div className="flex gap-4 mb-4 items-center">
        <input
          type="text"
          placeholder="Search by name, phone, or employee ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 max-w-md px-4 py-2 bg-surface-sunken border border-border-subtle rounded-radius-sm text-text-primary placeholder-text-secondary focus:outline-none focus:border-accent"
        />
        <label className="flex items-center text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="mr-2"
          />
          Show inactive
        </label>
      </div>

      {filteredWorkers.length === 0 ? (
        <div className="bg-surface-card rounded-radius-md p-8 text-center text-text-secondary">
          {workers.length === 0
            ? 'No technicians yet. Add your first technician to get started.'
            : 'No technicians match your search.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredWorkers.map((worker) => (
            <div
              key={worker.id}
              className={`bg-surface-card rounded-radius-md p-4 relative ${
                !worker.isActive ? 'opacity-50' : ''
              }`}
            >
              <div className="absolute top-3 right-3">
                <DropdownMenu
                  items={[
                    {
                      label: worker.isActive ? 'Deactivate' : 'Activate',
                      icon: Power,
                      onClick: () => handleToggleActive(worker),
                    },
                    { label: 'Edit', icon: Pencil, onClick: () => handleEdit(worker) },
                    { label: 'Delete', icon: Trash2, onClick: () => handleDelete(worker.id), variant: 'danger' },
                  ]}
                />
              </div>
              <h3
                onClick={() => setViewingWorker(worker)}
                className="font-semibold text-text-primary pr-8 cursor-pointer hover:text-accent hover:underline transition-colors"
              >
                {worker.name}
              </h3>
              <span
                className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-radius-full font-medium ${
                  worker.isActive
                    ? 'bg-accent/20 text-accent'
                    : 'bg-surface-sunken text-text-secondary'
                }`}
              >
                {worker.isActive ? 'Active' : 'Inactive'}
              </span>
              <div className="mt-3 space-y-1 text-sm text-text-secondary">
                <p>Phone: {worker.phone || '-'}</p>
                <p className="font-mono">ID: {worker.employeeId || '-'}</p>
                <p className="tabular-nums">Hired: {worker.hireDate ? new Date(worker.hireDate).toLocaleDateString() : '-'}</p>
              </div>
              {worker.notes && (
                <p className="mt-2 text-xs text-text-secondary border-t border-border-subtle pt-2">{worker.notes}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <TechnicianModal
          worker={editingWorker}
          onSave={handleSave}
          onClose={() => setIsModalOpen(false)}
        />
      )}

      {viewingWorker && (
        <TechnicianDetailModal
          worker={viewingWorker}
          onClose={() => setViewingWorker(null)}
        />
      )}
    </div>
  )
}

function TechnicianModal({
  worker,
  onSave,
  onClose,
}: {
  worker: Worker | null
  onSave: (data: Omit<Worker, 'id' | 'createdAt'>) => void
  onClose: () => void
}) {
  const [name, setName] = useState(worker?.name ?? '')
  const [phone, setPhone] = useState(worker?.phone ?? '')
  const [employeeId, setEmployeeId] = useState(worker?.employeeId ?? '')
  const [hireDate, setHireDate] = useState(worker?.hireDate ?? '')
  const [isActive, setIsActive] = useState(worker?.isActive ?? true)
  const [notes, setNotes] = useState(worker?.notes ?? '')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    onSave({ name, phone, employeeId, hireDate, isActive, notes })
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 backdrop-blur-[8px]" style={{ backgroundColor: 'var(--overlay-scrim)' }}>
      <div className="bg-surface-card rounded-radius-md w-full max-w-md p-6">
        <h2 className="text-xl font-bold text-text-primary mb-4">
          {worker ? 'Edit Technician' : 'Add Technician'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-surface-sunken border border-border-subtle rounded-radius-sm text-text-primary focus:outline-none focus:border-accent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 bg-surface-sunken border border-border-subtle rounded-radius-sm text-text-primary focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Employee ID</label>
            <input
              type="text"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="w-full px-3 py-2 bg-surface-sunken border border-border-subtle rounded-radius-sm text-text-primary font-mono focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Hire Date</label>
            <input
              type="date"
              value={hireDate}
              onChange={(e) => setHireDate(e.target.value)}
              className="w-full px-3 py-2 bg-surface-sunken border border-border-subtle rounded-radius-sm text-text-primary focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm text-text-secondary">Active</span>
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 bg-surface-sunken border border-border-subtle rounded-radius-sm text-text-primary focus:outline-none focus:border-accent"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-text-secondary hover:text-text-primary">
              Cancel
            </button>
            <button
              type="submit"
              className="bg-accent text-surface-canvas px-4 py-2 rounded-radius-sm hover:opacity-90 transition-opacity font-medium"
            >
              {worker ? 'Save Changes' : 'Add Technician'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function TechnicianDetailModal({
  worker,
  onClose,
}: {
  worker: Worker
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 backdrop-blur-[8px]" style={{ backgroundColor: 'var(--overlay-scrim)' }}>
      <div className="bg-surface-card rounded-radius-md w-full max-w-md p-6">
        <h2 className="text-xl font-bold text-text-primary mb-4">{worker.name}</h2>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-text-secondary">Status</span>
            <span className={`px-2 py-0.5 text-xs rounded-radius-full font-medium ${
              worker.isActive
                ? 'bg-accent/20 text-accent'
                : 'bg-surface-sunken text-text-secondary'
            }`}>
              {worker.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-secondary">Phone</span>
            <span className="text-text-primary">{worker.phone || '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-secondary">Employee ID</span>
            <span className="text-text-primary font-mono">{worker.employeeId || '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-secondary">Hire Date</span>
            <span className="text-text-primary tabular-nums">
              {worker.hireDate ? new Date(worker.hireDate).toLocaleDateString() : '-'}
            </span>
          </div>
          {worker.notes && (
            <div className="pt-2 border-t border-border-subtle">
              <span className="text-text-secondary text-sm">Notes</span>
              <p className="text-text-primary mt-1">{worker.notes}</p>
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          className="mt-6 w-full px-4 py-2 border border-border-subtle rounded-radius-sm text-text-secondary hover:text-text-primary hover:bg-surface-sunken transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  )
}
