import { useState } from 'react'
import { useWorkerStore, Worker } from '../store/workerStore'
import { useToastStore } from '../store/toastStore'
import { useConfirmStore } from '../store/confirmStore'
import { deleteWorkerChecked } from '../lib/ops/entityOps'
import { formatDate } from '../lib/dates'
import { filterBySearch } from '../lib/entitySearch'
import { deleteOutcomeToast } from '../lib/deleteOutcome'
import { rowEditOnDoubleClick } from '../lib/rowInteraction'
import { useTranslation } from '../lib/i18n'
import { RowActions } from '../components/ui/RowActions'
import { Power, Plus } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { PageHeader } from '../components/ui/PageHeader'
import { Dialog, DialogFooter, DialogActions } from '../components/ui/Dialog'
import { Input, Textarea } from '../components/ui/Input'

export default function Technicians() {
  const { t, tc } = useTranslation()
  const { workers, addWorker, updateWorker } = useWorkerStore()
  const showToast = useToastStore((s) => s.show)
  const requestConfirm = useConfirmStore((s) => s.request)
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null)
  const [viewingWorker, setViewingWorker] = useState<Worker | null>(null)

  const filteredWorkers = filterBySearch(workers, search, (w) => [w.name, w.phone, w.employeeId]).filter(
    (w) => showInactive || w.isActive
  )

  const handleAdd = () => {
    setEditingWorker(null)
    setIsModalOpen(true)
  }

  const handleEdit = (worker: Worker) => {
    setEditingWorker(worker)
    setIsModalOpen(true)
  }

  const handleDelete = (id: string) => {
    requestConfirm(
      { title: t('technicians.deleteConfirmTitle'), message: t('technicians.deleteConfirmMessage') },
      () => {
        const result = deleteWorkerChecked(id)
        const toast = deleteOutcomeToast(result, { cannotDeleteTitle: t('technicians.cannotDeleteTitle') })
        if (toast) showToast(toast)
      }
    )
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
    <div>
      <PageHeader
        title={t('technicians.title')}
        caption={tc('technicians.activeCount', activeCount)}
        action={
          <Button variant="primary" icon={Plus} onClick={handleAdd}>
            {t('technicians.addTechnician')}
          </Button>
        }
      />

      <div className="flex gap-4 mb-4 items-center">
        <div className="flex-1 max-w-md">
          <Input
            placeholder={t('technicians.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="accent-accent"
          />
          {t('technicians.showInactive')}
        </label>
      </div>

      {filteredWorkers.length === 0 ? (
        <div className="bg-surface-card rounded-radius-md p-8 text-center text-text-secondary">
          {workers.length === 0 ? t('technicians.emptyNone') : t('technicians.emptySearch')}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredWorkers.map((worker) => (
            <div
              key={worker.id}
              className={`bg-surface-card rounded-radius-md p-4 relative ${
                !worker.isActive ? 'opacity-50' : ''
              }`}
              {...rowEditOnDoubleClick(() => handleEdit(worker))}
            >
              <div className="absolute top-3 right-3">
                <RowActions
                  leadingItems={[{
                    label: worker.isActive ? t('technicians.deactivate') : t('technicians.activate'),
                    icon: Power,
                    onClick: () => handleToggleActive(worker),
                  }]}
                  onEdit={() => handleEdit(worker)}
                  onDelete={() => handleDelete(worker.id)}
                />
              </div>
              <h3
                onClick={() => setViewingWorker(worker)}
                data-no-row-edit
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
                {worker.isActive ? t('technicians.active') : t('technicians.inactive')}
              </span>
              <div className="mt-3 space-y-1 text-sm text-text-secondary">
                <p>{t('technicians.phoneField')} {worker.phone || '-'}</p>
                <p className="font-mono">{t('technicians.idField')} {worker.employeeId || '-'}</p>
                <p className="tabular-nums">{t('technicians.hiredField')} {worker.hireDate ? formatDate(worker.hireDate) : '-'}</p>
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
  const { t } = useTranslation()
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
    <Dialog open onClose={onClose} title={worker ? t('technicians.editTitle') : t('technicians.addTitle')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label={t('technicians.nameLabel')} value={name} onChange={(e) => setName(e.target.value)} required />
        <Input label={t('technicians.phoneLabel')} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Input label={t('technicians.employeeIdLabel')} mono value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} />
        <Input label={t('technicians.hireDateLabel')} type="date" value={hireDate} onChange={(e) => setHireDate(e.target.value)} />
        <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="accent-accent"
          />
          {t('technicians.activeLabel')}
        </label>
        <Textarea label={t('technicians.notesLabel')} value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        <DialogActions onCancel={onClose} confirmType="submit" confirmLabel={worker ? t('technicians.saveChanges') : t('technicians.addTechnician')} />
      </form>
    </Dialog>
  )
}

function TechnicianDetailModal({
  worker,
  onClose,
}: {
  worker: Worker
  onClose: () => void
}) {
  const { t } = useTranslation()
  return (
    <Dialog open onClose={onClose} title={worker.name}>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-text-secondary">{t('technicians.detailStatus')}</span>
            <span className={`px-2 py-0.5 text-xs rounded-radius-full font-medium ${
              worker.isActive
                ? 'bg-accent/20 text-accent'
                : 'bg-surface-sunken text-text-secondary'
            }`}>
              {worker.isActive ? t('technicians.active') : t('technicians.inactive')}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-secondary">{t('technicians.detailPhone')}</span>
            <span className="text-text-primary">{worker.phone || '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-secondary">{t('technicians.detailEmployeeId')}</span>
            <span className="text-text-primary font-mono">{worker.employeeId || '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-secondary">{t('technicians.detailHireDate')}</span>
            <span className="text-text-primary tabular-nums">
              {worker.hireDate ? formatDate(worker.hireDate) : '-'}
            </span>
          </div>
          {worker.notes && (
            <div className="pt-2 border-t border-border-subtle">
              <span className="text-text-secondary text-sm">{t('technicians.detailNotes')}</span>
              <p className="text-text-primary mt-1">{worker.notes}</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            {t('common.close')}
          </Button>
        </DialogFooter>
    </Dialog>
  )
}
