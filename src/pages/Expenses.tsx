import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useExpenseStore, Expense, EXPENSE_CATEGORIES } from '../store/expenseStore'
import { useInventoryStore } from '../store/inventoryStore'
import { useSupplierStore } from '../store/supplierStore'
import { recordExpense, deleteExpenseWithStockReversal } from '../lib/ops/inventoryOps'
import { useToastStore } from '../store/toastStore'
import { useConfirmStore } from '../store/confirmStore'
import { formatCurrency } from '../lib/currency'
import { rowEditOnDoubleClick } from '../lib/rowInteraction'
import { useTranslation } from '../lib/i18n'
import { DropdownMenu } from '../components/ui/DropdownMenu'
import { Pencil, Trash2, Plus, Receipt } from 'lucide-react'
import { EmptyState } from '../components/ui/EmptyState'
import { Button } from '../components/ui/Button'
import { PageHeader } from '../components/ui/PageHeader'
import { Dialog, DialogFooter } from '../components/ui/Dialog'
import { Input, Select, Textarea } from '../components/ui/Input'

const CATEGORY_KEYS: Record<string, string> = {
  'Inventory Purchase': 'categoryInventoryPurchase',
  Rent: 'categoryRent',
  Utilities: 'categoryUtilities',
  Equipment: 'categoryEquipment',
  Payroll: 'categoryPayroll',
  Insurance: 'categoryInsurance',
  Marketing: 'categoryMarketing',
  Supplies: 'categorySupplies',
  'Repairs & Maintenance': 'categoryRepairsMaintenance',
  Other: 'categoryOther',
}

const INVENTORY_PURCHASE_CATEGORY = 'Inventory Purchase'
const OTHER_VENDOR_VALUE = '__other__'
const ADD_NEW_SUPPLIER_VALUE = '__add_new_supplier__'

export default function Expenses() {
  const { t, tc, language } = useTranslation()
  const categoryLabel = (c: string) => t(`expenses.${CATEGORY_KEYS[c] ?? 'categoryOther'}`)
  const { expenses, updateExpense } = useExpenseStore()
  const { products } = useInventoryStore()
  const { suppliers } = useSupplierStore()
  const showToast = useToastStore((s) => s.show)
  const requestConfirm = useConfirmStore((s) => s.request)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)
  const [filterCategory, setFilterCategory] = useState('')
  const [filterMonth, setFilterMonth] = useState('')

  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0])
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [vendor, setVendor] = useState('')
  // Vendor is a plain string on Expense (no schema change) — this just
  // controls whether the form shows the Supplier <Select> or a free-text
  // <Input> for a vendor that isn't a registered Supplier.
  const [vendorMode, setVendorMode] = useState<'select' | 'other'>('select')
  const [notes, setNotes] = useState('')

  // Product link — create mode only (an Inventory Purchase expense may
  // optionally be tied to a specific product + quantity, which also bumps
  // that product's stock; see recordExpense in src/lib/ops/inventoryOps.ts).
  // Once an expense is created with a link, editing shows it read-only
  // (rendered straight from `editing.productId`/`quantityAffected`, no local
  // state needed) — changing the link without adjusting stock would corrupt
  // the invariant, same reasoning as Qty On Hand becoming read-only when
  // editing a Product.
  const [linkedProductId, setLinkedProductId] = useState('')
  const [linkedQty, setLinkedQty] = useState('')
  const [amountEdited, setAmountEdited] = useState(false)

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
    setVendorMode('select')
    setNotes('')
    setEditing(null)
    setLinkedProductId('')
    setLinkedQty('')
    setAmountEdited(false)
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
    // A legacy/custom vendor string that no longer matches any Supplier
    // shows in "Other" mode instead of appearing to silently reset.
    setVendorMode(e.vendor && !suppliers.some(s => s.name === e.vendor) ? 'other' : 'select')
    setNotes(e.notes)
    setShowModal(true)
  }

  // Arrival from Suppliers after "+ Add new supplier…" — reopen Add Expense
  // with the newly created supplier preselected as Vendor. Mirrors the
  // existing Work Order <-> Companies "add new driver" round trip.
  useEffect(() => {
    if (searchParams.get('new')) {
      resetForm()
      const vendorParam = searchParams.get('vendor')
      if (vendorParam) {
        setVendor(vendorParam)
        setVendorMode('select')
      }
      setShowModal(true)
      setSearchParams({}, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resetForm/setVendor etc. are stable setters; only searchParams should retrigger this
  }, [searchParams])

  // Product link changed — starting a fresh quantity means the previous
  // auto-filled amount no longer applies.
  const handleLinkedProductChange = (productId: string) => {
    setLinkedProductId(productId)
    setLinkedQty('')
    setAmountEdited(false)
  }

  // Quantity changed — auto-fill amount (qty × cost price) and, if the user
  // hasn't typed a description yet, suggest one. Both stop once the user
  // edits amount directly (amountEdited), same convention as the Adjust
  // Stock dialog in src/pages/Inventory.tsx.
  const handleLinkedQtyChange = (value: string) => {
    setLinkedQty(value)
    const product = products.find(p => p.id === linkedProductId)
    const qty = parseFloat(value) || 0
    if (!product || qty <= 0) return
    if (!amountEdited) setAmount(String(qty * product.costPrice))
    if (!description.trim()) setDescription(product.name)
  }

  const handleSave = () => {
    if (!description.trim()) return showToast({ tone: 'danger', title: t('expenses.descriptionRequired') })
    if (!amount) return showToast({ tone: 'danger', title: t('expenses.amountRequired') })

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
      const qty = parseFloat(linkedQty) || 0
      const linked = category === INVENTORY_PURCHASE_CATEGORY && linkedProductId && qty > 0
        ? { productId: linkedProductId, quantity: qty }
        : null
      recordExpense(data, linked)
    }
    setShowModal(false)
    resetForm()
  }

  const handleDelete = (id: string) => {
    requestConfirm(
      { title: t('expenses.deleteConfirmTitle'), message: t('expenses.deleteConfirmMessage') },
      () => deleteExpenseWithStockReversal(id)
    )
  }

  return (
    <div>
      <PageHeader
        title={t('expenses.title')}
        action={
          <Button variant="primary" icon={Plus} onClick={openCreate}>
            {t('expenses.addExpense')}
          </Button>
        }
      />

      <div className="bg-surface-card rounded-radius-md p-4 mb-6">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-caption">
              {filterCategory || filterMonth ? t('expenses.filteredTotal') : t('expenses.allTimeTotal')}
            </p>
            <p className="text-kpi text-text-primary">{formatCurrency(totalFiltered)}</p>
          </div>
          <p className="text-text-secondary">{tc('expenses.expenseCount', filtered.length)}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 mb-4">
        <div className="w-48">
          <Select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
            <option value="">{t('expenses.allCategories')}</option>
            {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{categoryLabel(c)}</option>)}
          </Select>
        </div>
        <div className="w-48">
          <Select value={filterMonth} onChange={e => setFilterMonth(e.target.value)}>
            <option value="">{t('expenses.allTime')}</option>
            {months.map(m => (
              <option key={m} value={m}>
                {new Date(m + '-01').toLocaleDateString(language === 'id' ? 'id-ID' : 'en-US', { month: 'long', year: 'numeric' })}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={filterCategory || filterMonth ? t('expenses.emptyTitleFiltered') : t('expenses.emptyTitleNone')}
          message={filterCategory || filterMonth ? t('expenses.emptyMessageFiltered') : t('expenses.emptyMessageNone')}
        />
      ) : (
        <div className="bg-surface-card rounded-radius-md overflow-auto max-h-[70vh]">
          <table className="w-full">
            <thead className="bg-surface-sunken border-b border-border-subtle sticky top-0 z-10">
              <tr>
                <th className="text-left p-3 font-medium text-text-secondary">{t('expenses.colDate')}</th>
                <th className="text-left p-3 font-medium text-text-secondary">{t('expenses.colCategory')}</th>
                <th className="text-left p-3 font-medium text-text-secondary">{t('expenses.colDescription')}</th>
                <th className="text-center p-3 font-medium text-text-secondary">{t('expenses.colQuantity')}</th>
                <th className="text-left p-3 font-medium text-text-secondary">{t('expenses.colVendor')}</th>
                <th className="text-right p-3 font-medium text-text-secondary">{t('expenses.colAmount')}</th>
                <th className="text-right p-3 font-medium text-text-secondary">{t('expenses.colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => (
                <tr key={e.id} {...rowEditOnDoubleClick(() => openEdit(e))} className="border-t border-border-subtle hover:bg-surface-sunken">
                  <td className="p-3 font-mono text-sm text-text-secondary tabular-nums">{new Date(e.date).toLocaleDateString()}</td>
                  <td className="p-3">
                    <span className="px-2 py-1 bg-surface-sunken rounded-radius-sm text-sm text-text-secondary">{categoryLabel(e.category)}</span>
                  </td>
                  <td className="p-3 text-text-primary">{e.description}</td>
                  <td className="p-3 text-center font-mono text-text-secondary tabular-nums">{e.quantityAffected ?? '-'}</td>
                  <td className="p-3 text-text-secondary">{e.vendor || '-'}</td>
                  <td className="p-3 text-right font-mono font-medium text-text-primary tabular-nums">{formatCurrency(e.amount)}</td>
                  <td className="p-3 text-right">
                    <DropdownMenu
                      items={[
                        { label: t('common.edit'), icon: Pencil, onClick: () => openEdit(e) },
                        { label: t('common.delete'), icon: Trash2, onClick: () => handleDelete(e.id), variant: 'danger' },
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
        title={editing ? t('expenses.editTitle') : t('expenses.addTitle')}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('expenses.dateLabel')} type="date" mono value={date} onChange={e => setDate(e.target.value)} />
            <Input
              label={t('expenses.amountLabel')}
              type="number"
              step="0.01"
              mono
              value={amount}
              onChange={e => { setAmount(e.target.value); if (linkedProductId) setAmountEdited(true) }}
              placeholder="0"
            />
          </div>
          <Select
            label={t('expenses.categoryLabel')}
            value={category}
            onChange={e => {
              setCategory(e.target.value)
              if (e.target.value !== INVENTORY_PURCHASE_CATEGORY) {
                setLinkedProductId('')
                setLinkedQty('')
                setAmountEdited(false)
              }
            }}
          >
            {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{categoryLabel(c)}</option>)}
          </Select>
          {!editing && category === INVENTORY_PURCHASE_CATEGORY && (
            <div className="grid grid-cols-2 gap-4">
              <Select
                label={t('expenses.linkedProductLabel')}
                value={linkedProductId}
                onChange={e => handleLinkedProductChange(e.target.value)}
              >
                <option value="">{t('expenses.noSpecificProduct')}</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
              {linkedProductId && (
                <Input
                  label={t('expenses.linkedQuantityLabel')}
                  type="number"
                  mono
                  value={linkedQty}
                  onChange={e => handleLinkedQtyChange(e.target.value)}
                  min="1"
                />
              )}
            </div>
          )}
          <Input label={t('expenses.descriptionLabel')} value={description} onChange={e => setDescription(e.target.value)} placeholder={t('expenses.descriptionPlaceholder')} />
          <div className={editing?.productId ? 'grid grid-cols-2 gap-4' : ''}>
            {vendorMode === 'other' ? (
              <Input
                label={t('expenses.vendorLabel')}
                value={vendor}
                onChange={e => setVendor(e.target.value)}
                placeholder={t('expenses.vendorPlaceholder')}
              />
            ) : (
              <Select
                label={t('expenses.vendorLabel')}
                value={vendor}
                onChange={e => {
                  const val = e.target.value
                  if (val === ADD_NEW_SUPPLIER_VALUE) {
                    navigate('/suppliers?new=1&fromExpense=1')
                    return
                  }
                  if (val === OTHER_VENDOR_VALUE) {
                    setVendorMode('other')
                    setVendor('')
                    return
                  }
                  setVendor(val)
                }}
              >
                <option value="">{t('expenses.noVendor')}</option>
                {suppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                <option value={OTHER_VENDOR_VALUE}>{t('expenses.otherVendorOption')}</option>
                <option value={ADD_NEW_SUPPLIER_VALUE}>{t('expenses.addNewSupplierOption')}</option>
              </Select>
            )}
            {editing?.productId && (
              <Input
                label={t('expenses.linkedQuantityLabel')}
                type="number"
                mono
                value={editing.quantityAffected ?? ''}
                disabled
                readOnly
              />
            )}
          </div>
          <Textarea label={t('expenses.notesLabel')} value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => { setShowModal(false); resetForm() }}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" onClick={handleSave}>
            {editing ? t('expenses.saveChanges') : t('expenses.addExpense')}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}
