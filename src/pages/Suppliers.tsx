import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useSupplierStore, Supplier } from '../store/supplierStore'
import { useToastStore } from '../store/toastStore'
import { useConfirmStore } from '../store/confirmStore'
import { deleteSupplierDetaching } from '../lib/ops/entityOps'
import { rowEditOnDoubleClick } from '../lib/rowInteraction'
import { useTranslation } from '../lib/i18n'
import { DropdownMenu } from '../components/ui/DropdownMenu'
import { Pencil, Trash2, Plus, Truck } from 'lucide-react'
import { EmptyState } from '../components/ui/EmptyState'
import { Button } from '../components/ui/Button'
import { PageHeader } from '../components/ui/PageHeader'
import { Dialog, DialogFooter } from '../components/ui/Dialog'
import { Input, Textarea } from '../components/ui/Input'

export default function Suppliers() {
  const { t, tc } = useTranslation()
  const { suppliers, addSupplier, updateSupplier } = useSupplierStore()
  const showToast = useToastStore((s) => s.show)
  const requestConfirm = useConfirmStore((s) => s.request)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [search, setSearch] = useState('')
  const [returnToExpense, setReturnToExpense] = useState(false)

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

  // Arrival from Expenses via "+ Add new supplier…" — open the Add Supplier
  // form and remember to return there once saved. Mirrors the existing
  // Work Order <-> Companies "add new driver" round trip.
  useEffect(() => {
    if (searchParams.get('new')) {
      setReturnToExpense(searchParams.get('fromExpense') === '1')
      openCreate()
      setSearchParams({}, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- openCreate/resetForm are stable; only searchParams should retrigger this
  }, [searchParams])

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
    if (!name.trim()) return showToast({ tone: 'danger', title: t('suppliers.nameRequired') })

    if (editing) {
      updateSupplier(editing.id, { name, phone, email, address, notes })
    } else {
      const created = addSupplier({ name, phone, email, address, notes })
      if (returnToExpense) {
        setReturnToExpense(false)
        setShowModal(false)
        navigate(`/expenses?new=1&vendor=${encodeURIComponent(created.name)}`)
        return
      }
    }
    setShowModal(false)
    resetForm()
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
        <div className="bg-surface-card rounded-radius-md overflow-auto max-h-[70vh]">
          <table className="w-full">
            <thead className="bg-surface-sunken border-b border-border-subtle sticky top-0 z-10">
              <tr>
                <th className="text-left p-3 font-medium text-text-secondary">{t('suppliers.colName')}</th>
                <th className="text-left p-3 font-medium text-text-secondary">{t('suppliers.colPhone')}</th>
                <th className="text-left p-3 font-medium text-text-secondary">{t('suppliers.colEmail')}</th>
                <th className="text-left p-3 font-medium text-text-secondary">{t('suppliers.colAddress')}</th>
                <th className="text-right p-3 font-medium text-text-secondary">{t('suppliers.colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} {...rowEditOnDoubleClick(() => openEdit(s))} className="border-t border-border-subtle hover:bg-surface-sunken">
                  <td className="p-3 font-medium text-text-primary">{s.name}</td>
                  <td className="p-3 text-text-secondary">{s.phone || '-'}</td>
                  <td className="p-3 text-text-secondary">{s.email || '-'}</td>
                  <td className="p-3 text-sm text-text-secondary">{s.address || '-'}</td>
                  <td className="p-3 text-right">
                    <DropdownMenu
                      items={[
                        { label: t('common.edit'), icon: Pencil, onClick: () => openEdit(s) },
                        { label: t('common.delete'), icon: Trash2, onClick: () => handleDelete(s.id), variant: 'danger' },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog
        open={showModal}
        onClose={() => { setShowModal(false); resetForm() }}
        title={editing ? t('suppliers.editTitle') : t('suppliers.addTitle')}
      >
        <div className="space-y-4">
          <Input label={t('suppliers.nameLabel')} value={name} onChange={e => setName(e.target.value)} />
          <Input label={t('suppliers.phoneLabel')} type="tel" value={phone} onChange={e => setPhone(e.target.value)} />
          <Input label={t('suppliers.emailLabel')} type="email" value={email} onChange={e => setEmail(e.target.value)} />
          <Input label={t('suppliers.addressLabel')} value={address} onChange={e => setAddress(e.target.value)} />
          <Textarea label={t('suppliers.notesLabel')} value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => { setShowModal(false); resetForm() }}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" onClick={handleSave}>
            {editing ? t('suppliers.saveChanges') : t('suppliers.addSupplier')}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}
