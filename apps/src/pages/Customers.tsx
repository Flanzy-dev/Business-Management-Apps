import { useDeferredValue, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCustomerStore, Customer } from '../store/customerStore'
import { useToastStore, useConfirmStore } from '../store/uiStores'
import { createCustomer, updateCustomerLogged, deleteCustomerChecked } from '../lib/ops/entityOps'
import { buildCustomerRows, filterCustomerRows, sortCustomerRows, nextCustomerSort, DEFAULT_CUSTOMER_SORT, type CustomerSortKey } from '../lib/customers/customerList'
import { useVehicleStore } from '../store/vehicleStore'
import { useWorkOrderStore } from '../store/workOrderStore'
import { useOpenRecordFromNav } from '../hooks/useOpenRecordFromNav'
import { formatDate } from '../lib/format/dates'
import { workOrderReturnPath } from '../lib/orders/returnTrip'
import { useNewEntityRequest } from '../hooks/useNewEntityRequest'
import { useRequiredFields } from '../hooks/useRequiredFields'
import { useIncrementalList } from '../hooks/useIncrementalList'
import { ShowMoreFooter } from '../components/ui/ShowMoreFooter'
import { deleteOutcomeToast } from '../lib/ops/deletion'
import { rowEditOnDoubleClick } from '../lib/app/rowInteraction'
import { useTranslation } from '../lib/i18n'
import { RowActions } from '../components/ui/RowActions'
import { Plus, Car, Users } from 'lucide-react'
import { SortableTh } from '../components/ui/SortableTh'
import { EmptyState } from '../components/ui/EmptyState'
import { Button } from '../components/ui/Button'
import { PageHeader } from '../components/ui/PageHeader'
import { Dialog, DialogFooter } from '../components/ui/Dialog'
import { Input, Textarea } from '../components/ui/Input'

export default function Customers() {
  const { t } = useTranslation()
  const customers = useCustomerStore((s) => s.customers)
  const showToast = useToastStore((s) => s.show)
  const requestConfirm = useConfirmStore((s) => s.request)
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [returnToOrder, setReturnToOrder] = useState(false)

  // Typing stays instant: the filter + row render run on the deferred value,
  // and only the first batch of matches is mounted (see useIncrementalList).
  const deferredSearch = useDeferredValue(search)
  const vehicles = useVehicleStore((s) => s.vehicles)
  const workOrders = useWorkOrderStore((s) => s.workOrders)
  const [sort, setSort] = useState(DEFAULT_CUSTOMER_SORT)
  const rows = useMemo(() => buildCustomerRows(customers, vehicles, workOrders), [customers, vehicles, workOrders])
  const filteredCustomers = useMemo(
    () => sortCustomerRows(filterCustomerRows(rows, deferredSearch), sort),
    [rows, deferredSearch, sort]
  )
  const list = useIncrementalList(filteredCustomers, `${deferredSearch}|${sort.key}|${sort.direction}`)
  const sortableColumn = (key: CustomerSortKey, label: string) => ({
    sortKey: key,
    label,
    active: sort.key === key,
    direction: sort.direction,
    onSort: (k: CustomerSortKey) => setSort((current) => nextCustomerSort(current, k)),
  })

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

  // Global search opens the customer it found (src/lib/app/navigation.ts).
  useOpenRecordFromNav((id) => {
    const found = useCustomerStore.getState().customers.find((c) => c.id === id)
    if (found) handleEdit(found)
  })

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
      // updateCustomerLogged owns the store write and the activity-log entry
      // together, the same way createCustomer and deleteCustomerChecked do.
      updateCustomerLogged(editingCustomer.id, data)
      showToast({ tone: 'success', title: t('customers.savedToast') })
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
          placeholder={t('customers.searchPlaceholder')} aria-label={t('customers.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filteredCustomers.length === 0 ? (
        <EmptyState
          icon={Users}
          title={customers.length === 0 ? t('customers.emptyNone') : t('customers.emptySearch')}
          action={customers.length === 0 && (
            <Button variant="primary" icon={Plus} onClick={handleAdd}>{t('customers.addCustomer')}</Button>
          )}
        />
      ) : (
      <div className="bg-surface-card border border-border-2 rounded-radius-md overflow-auto max-h-[70vh]">
        <table className="w-full text-sm">
          <thead className="bg-surface-sunken border-b border-border-subtle sticky top-0 z-10">
            <tr>
              <SortableTh {...sortableColumn('name', t('customers.colName'))} />
              <th className="text-left p-3 font-medium text-text-secondary">{t('customers.colPhone')}</th>
              <SortableTh {...sortableColumn('vehicles', t('customers.colVehicles'))} />
              <SortableTh {...sortableColumn('lastVisit', t('customers.colLastVisit'))} />
              <th className="text-right p-3 font-medium text-text-secondary">{t('customers.colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {list.visible.map(({ customer, plates, lastVisit }) => (
              <tr key={customer.id} {...rowEditOnDoubleClick(() => handleEdit(customer))} className="border-t border-border-subtle hover:bg-surface-sunken">
                <td className="p-3 font-medium text-text-primary">{customer.name}</td>
                <td className="p-3 text-text-secondary font-mono tabular-nums">{customer.phone}</td>
                <td className="p-3 text-text-secondary font-mono">{plates.join(', ')}</td>
                <td className="p-3 text-text-secondary font-mono tabular-nums">{lastVisit ? formatDate(lastVisit) : '—'}</td>
                <td className="p-3 text-right">
                  <RowActions onEdit={() => handleEdit(customer)} onDelete={() => handleDelete(customer.id)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
      <ShowMoreFooter shown={list.shown} total={list.total} onShowMore={list.showMore} />

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

  const { errors, validate, clear } = useRequiredFields<'name'>()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate({ name })) return
    onSave(buildData())
  }

  // type="button", so the browser never runs its own checks for it: validate()
  // covers the blank name (without it this button did nothing at all) and
  // reportValidity() covers the format checks a submit would have made (email).
  const handleSaveAndAddVehicle = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!validate({ name })) return
    if (!e.currentTarget.form?.reportValidity()) return
    onSave(buildData(), { addVehicle: true })
  }

  return (
    <Dialog closeOnScrimClick={false} open onClose={onClose} title={customer ? t('customers.editTitle') : t('customers.addTitle')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label={t('customers.nameLabel')}
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            clear('name')
          }}
          error={errors.name}
          aria-required="true"
        />
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
