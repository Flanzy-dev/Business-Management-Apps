import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSupplierStore, Supplier } from '../store/supplierStore'
import { useToastStore } from '../store/toastStore'
import { useConfirmStore } from '../store/confirmStore'
import { deleteSupplierDetaching } from '../lib/ops/entityOps'
import { filterBySearch } from '../lib/entitySearch'
import { useNewEntityRequest } from '../hooks/useNewEntityRequest'
import { initialSupplierDraft, supplierDraftFrom, validateSupplierDraft, type SupplierDraft } from '../lib/supplierForm'
import { useTranslation } from '../lib/i18n'
import { Plus, Truck } from 'lucide-react'
import { EmptyState } from '../components/ui/EmptyState'
import { Button } from '../components/ui/Button'
import { PageHeader } from '../components/ui/PageHeader'
import { Input } from '../components/ui/Input'
import { SupplierTable } from '../components/suppliers/SupplierTable'
import { SupplierFormDialog } from '../components/suppliers/SupplierFormDialog'

export default function Suppliers() {
  const { t, tc } = useTranslation()
  const { suppliers, addSupplier, updateSupplier } = useSupplierStore()
  const showToast = useToastStore((s) => s.show)
  const requestConfirm = useConfirmStore((s) => s.request)
  const navigate = useNavigate()
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [search, setSearch] = useState('')
  const [returnToExpense, setReturnToExpense] = useState(false)
  const [draft, setDraft] = useState<SupplierDraft>(initialSupplierDraft)
  const patch = (fields: Partial<SupplierDraft>) => setDraft((d) => ({ ...d, ...fields }))

  const filtered = filterBySearch(suppliers, search, (s) => [s.name, s.phone])

  const openCreate = () => {
    setEditing(null)
    setDraft(initialSupplierDraft())
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditing(null)
  }

  // Arrival from Expenses via "+ Add new supplier…" — open the Add Supplier
  // form and remember to return there once saved. Mirrors the existing
  // Work Order <-> Companies "add new driver" round trip.
  useNewEntityRequest((shouldReturn) => {
    setReturnToExpense(shouldReturn)
    openCreate()
  }, { returnFlag: 'fromExpense' })

  const openEdit = (s: Supplier) => {
    setEditing(s)
    setDraft(supplierDraftFrom(s))
    setShowModal(true)
  }

  const handleSave = () => {
    if (!validateSupplierDraft(draft).ok) return showToast({ tone: 'danger', title: t('suppliers.nameRequired') })

    if (editing) {
      updateSupplier(editing.id, draft)
    } else {
      const created = addSupplier(draft)
      if (returnToExpense) {
        setReturnToExpense(false)
        closeModal()
        navigate(`/expenses?new=1&vendor=${encodeURIComponent(created.name)}`)
        return
      }
    }
    closeModal()
  }

  const handleDelete = (id: string) => {
    requestConfirm(
      {
        title: t('suppliers.deleteConfirmTitle'),
        message: t('suppliers.deleteConfirmMessage'),
      },
      () => {
        const { detachedProducts } = deleteSupplierDetaching(id)
        if (detachedProducts > 0) {
          showToast({
            tone: 'neutral',
            title: t('suppliers.deletedTitle'),
            description: tc('suppliers.detachedProducts', detachedProducts),
          })
        }
      }
    )
  }

  return (
    <div>
      <PageHeader
        title={t('suppliers.title')}
        action={
          <Button variant="primary" icon={Plus} onClick={openCreate}>
            {t('suppliers.addSupplier')}
          </Button>
        }
      />

      <div className="mb-4 md:max-w-xs">
        <Input
          placeholder={t('suppliers.searchPlaceholder')}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Truck}
          title={search ? t('suppliers.emptyTitleFiltered') : t('suppliers.emptyTitleNone')}
          message={search ? t('suppliers.emptyMessageFiltered') : t('suppliers.emptyMessageNone')}
        />
      ) : (
        <SupplierTable suppliers={filtered} onEdit={openEdit} onDelete={handleDelete} />
      )}

      <SupplierFormDialog
        open={showModal}
        editing={!!editing}
        draft={draft}
        onChange={patch}
        onClose={closeModal}
        onSave={handleSave}
      />
    </div>
  )
}
