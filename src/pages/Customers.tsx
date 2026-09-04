import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCustomerStore, Customer } from '../store/customerStore'
import { useToastStore } from '../store/toastStore'
import { useConfirmStore } from '../store/confirmStore'
import { createCustomer, deleteCustomerChecked } from '../lib/ops/entityOps'
import { recordEntityChange } from '../lib/ops/activityOps'
import { filterBySearch } from '../lib/entitySearch'
import { workOrderReturnPath } from '../lib/returnTrip'
import { useNewEntityRequest } from '../hooks/useNewEntityRequest'
import { deleteOutcomeToast } from '../lib/deleteOutcome'
import { rowEditOnDoubleClick } from '../lib/rowInteraction'
import { useTranslation } from '../lib/i18n'
import { RowActions } from '../components/ui/RowActions'
import { Plus, Car } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { PageHeader } from '../components/ui/PageHeader'
import { Dialog, DialogFooter } from '../components/ui/Dialog'
import { Input, Textarea } from '../components/ui/Input'

export default function Customers() {
  const { t } = useTranslation()
  const customers = useCustomerStore((s) => s.customers)
  const updateCustomer = useCustomerStore((s) => s.updateCustomer)
  const showToast = useToastStore((s) => s.show)
  const requestConfirm = useConfirmStore((s) => s.request)
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [returnToOrder, setReturnToOrder] = useState(false)

  const filteredCustomers = filterBySearch(customers, search, (c) => [c.name, c.phone, c.email])

  const handleAdd = () => {
    setEditingCustomer(null)
    setIsModalOpen(true)
  }

  // Auto-open the add form when arriving via ?new=1 (e.g. from the new-order dialog).
  useNewEntityRequest((shouldReturn) => {
    setReturnToOrder(shouldReturn)
    handleAdd()
  })

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer)
    setIsModalOpen(true)
  }

  const handleDelete = (id: string) => {
    requestConfirm(
      { title: t('customers.deleteConfirmTitle'), message: t('customers.deleteConfirmMessage') },
      () => {
        // deleteCustomerChecked writes the activity-log entry itself — it can
        // still read the customer's name at that point, which this callback
        // can't once the row is gone. See src/lib/ops/activityOps.ts.
        const result = deleteCustomerChecked(id)
        const toast = deleteOutcomeToast(result, {
          cannotDeleteTitle: t('customers.cannotDeleteTitle'),
          deletedTitle: t('customers.deletedToast'),
        })
        if (toast) showToast(toast)
      }
    )
  }

  const handleSave = (data: Omit<Customer, 'id' | 'createdAt'>, opts?: { addVehicle?: boolean }) => {
    if (editingCustomer) {
      updateCustomer(editingCustomer.id, data)
      recordEntityChange('update', 'customer', editingCustomer.id, data.name)
    } else {
      const created = createCustomer(data)
      if (returnToOrder) {
        setReturnToOrder(false)
        setIsModalOpen(false)
        navigate(workOrderReturnPath('customer', created.id))
        return
      }
      if (opts?.addVehicle) {
        setIsModalOpen(false)
        navigate(`/vehicles?new=1&ownerType=customer&ownerId=${created.id}`)
        return
      }
    }
    setIsModalOpen(false)
  }

  return (
    <div>
      <PageHeader
        title={t('customers.title')}
        action={
          <Button variant="primary" icon={Plus} onClick={handleAdd}>
            {t('customers.addCustomer')}
          </Button>
        }
      />

      <div className="mb-4 max-w-md">
        <Input
          placeholder={t('customers.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="bg-surface-card rounded-radius-md overflow-auto max-h-[70vh]">
        <table className="w-full">
          <thead className="bg-surface-sunken border-b border-border-subtle sticky top-0 z-10">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-semibold text-text-secondary">{t('customers.colName')}</th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-text-secondary">{t('customers.colPhone')}</th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-text-secondary">{t('customers.colEmail')}</th>
              <th className="text-left px-4 py-3 text-sm font-semibold text-text-secondary">{t('customers.colAddress')}</th>
              <th className="text-right px-4 py-3 text-sm font-semibold text-text-secondary">{t('customers.colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredCustomers.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-text-secondary">
                  {customers.length === 0 ? t('customers.emptyNone') : t('customers.emptySearch')}
                </td>
              </tr>
            ) : (
              filteredCustomers.map((customer) => (
                <tr key={customer.id} {...rowEditOnDoubleClick(() => handleEdit(customer))} className="border-b border-border-subtle hover:bg-surface-sunken">
                  <td className="px-4 py-3 font-medium text-text-primary">{customer.name}</td>
                  <td className="px-4 py-3 text-text-secondary">{customer.phone}</td>
                  <td className="px-4 py-3 text-text-secondary">{customer.email}</td>
                  <td className="px-4 py-3 text-text-secondary">{customer.address}</td>
                  <td className="px-4 py-3 text-right">
                    <RowActions onEdit={() => handleEdit(customer)} onDelete={() => handleDelete(customer.id)} />
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
          showAddVehicleShortcut={!editingCustomer && !returnToOrder}
        />
      )}
    </div>
  )
}

function CustomerModal({
  customer,
  onSave,
  onClose,
  showAddVehicleShortcut,
}: {
  customer: Customer | null
  onSave: (data: Omit<Customer, 'id' | 'createdAt'>, opts?: { addVehicle?: boolean }) => void
  onClose: () => void
  showAddVehicleShortcut?: boolean
}) {
  const { t } = useTranslation()
  const [name, setName] = useState(customer?.name ?? '')
  const [phone, setPhone] = useState(customer?.phone ?? '')
  const [email, setEmail] = useState(customer?.email ?? '')
  const [address, setAddress] = useState(customer?.address ?? '')
  const [notes, setNotes] = useState(customer?.notes ?? '')

  const buildData = (): Omit<Customer, 'id' | 'createdAt'> => ({ name, phone, email, address, notes })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    onSave(buildData())
  }

  const handleSaveAndAddVehicle = () => {
    if (!name.trim()) return
    onSave(buildData(), { addVehicle: true })
  }

  return (
    <Dialog open onClose={onClose} title={customer ? t('customers.editTitle') : t('customers.addTitle')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label={t('customers.nameLabel')} value={name} onChange={(e) => setName(e.target.value)} required />
        <Input label={t('customers.phoneLabel')} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Input label={t('customers.emailLabel')} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input label={t('customers.addressLabel')} value={address} onChange={(e) => setAddress(e.target.value)} />
        <Textarea label={t('customers.notesLabel')} value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        <DialogFooter>
          <Button variant="ghost" type="button" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          {showAddVehicleShortcut && (
            <Button variant="secondary" type="button" icon={Car} onClick={handleSaveAndAddVehicle}>
              {t('customers.saveAndAddVehicle')}
            </Button>
          )}
          <Button variant="primary" type="submit">
            {customer ? t('customers.saveChanges') : t('customers.addCustomer')}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
