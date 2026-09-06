import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useInventoryStore } from '../../store/inventoryStore'
import { useSupplierStore } from '../../store/supplierStore'
import { EXPENSE_CATEGORIES, type Expense } from '../../store/expenseStore'
import { recordExpense, type ExpenseUpdateResult } from '../../lib/ops/inventoryOps'
import {
  initialExpenseDraft,
  expenseDraftFrom,
  validateExpenseDraft,
  expenseDraftToData,
  linkedPurchaseFrom,
  autoFillFromQuantity,
  type ExpenseDraft,
} from '../../lib/expenseForm'
import { expenseCategoryLabel } from '../../lib/entities'
import { useToastStore } from '../../store/toastStore'
import { useTranslation } from '../../lib/i18n'
import { Dialog, DialogActions } from '../ui/Dialog'
import { Input, Select, Textarea } from '../ui/Input'

const INVENTORY_PURCHASE_CATEGORY = 'Inventory Purchase'
const OTHER_VENDOR_VALUE = '__other__'
const ADD_NEW_SUPPLIER_VALUE = '__add_new_supplier__'

/**
 * Create/edit form for an expense, including the optional Inventory Purchase
 * product link (which also bumps that product's stock — see recordExpense in
 * inventoryOps.ts). Draft state and its conversions live in
 * src/lib/expenseForm.ts.
 */
export function ExpenseFormDialog({
  open,
  editing,
  onClose,
  onUpdate,
  prefillVendor,
}: {
  open: boolean
  /** The expense being edited, or null for a brand-new one. */
  editing: Expense | null
  onClose: () => void
  /** Returns why not, when a product-linked purchase's cost can no longer be
   *  corrected — see updateExpenseWithStockReversal in inventoryOps.ts. */
  onUpdate: (
    id: string,
    data: Omit<Expense, 'id' | 'createdAt' | 'productId' | 'quantityAffected'>
  ) => ExpenseUpdateResult
  /** Arrival from Suppliers after "+ Add new supplier…" — see Expenses.tsx's round-trip effect. */
  prefillVendor?: string
}) {
  const { t } = useTranslation()
  const { products } = useInventoryStore()
  const { suppliers } = useSupplierStore()
  const showToast = useToastStore((s) => s.show)
  const navigate = useNavigate()

  const [draft, setDraft] = useState<ExpenseDraft>(() => initialExpenseDraft())

  useEffect(() => {
    if (!open) return
    if (editing) {
      setDraft(expenseDraftFrom(editing, suppliers))
    } else {
      const fresh = initialExpenseDraft()
      setDraft(prefillVendor ? { ...fresh, vendor: prefillVendor } : fresh)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- suppliers/prefillVendor are read once per open, not tracked live
  }, [open, editing?.id])

  const set = <K extends keyof ExpenseDraft>(key: K, value: ExpenseDraft[K]) => setDraft((d) => ({ ...d, [key]: value }))

  // Product link changed — starting a fresh quantity means the previous
  // auto-filled amount no longer applies.
  const handleLinkedProductChange = (productId: string) => {
    setDraft((d) => ({ ...d, linkedProductId: productId, linkedQty: '', amountEdited: false }))
  }

  const handleLinkedQtyChange = (value: string) => {
    const product = products.find((p) => p.id === draft.linkedProductId)
    const fill = autoFillFromQuantity(value, product, draft.description, draft.amountEdited)
    setDraft((d) => ({ ...d, linkedQty: value, ...fill }))
  }

  const handleSave = () => {
    const validation = validateExpenseDraft(draft)
    if (!validation.ok) {
      if (validation.descriptionRequired) return showToast({ tone: 'danger', title: t('expenses.descriptionRequired') })
      return showToast({ tone: 'danger', title: t('expenses.amountRequired') })
    }

    const data = expenseDraftToData(draft)
    if (editing) {
      // Stays open on a refusal, same as the validation failures above — the
      // edit did not happen, so closing would imply it had.
      const result = onUpdate(editing.id, data)
      if (!result.ok) return showToast({ tone: 'danger', title: result.reason })
    } else {
      recordExpense(data, linkedPurchaseFrom(draft))
    }
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} title={editing ? t('expenses.editTitle') : t('expenses.addTitle')}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label={t('expenses.dateLabel')} type="date" mono value={draft.date} onChange={(e) => set('date', e.target.value)} />
          <Input
            label={t('expenses.amountLabel')}
            type="number"
            step="0.01"
            mono
            value={draft.amount}
            onChange={(e) => {
              set('amount', e.target.value)
              if (draft.linkedProductId) set('amountEdited', true)
            }}
            placeholder="0"
          />
        </div>
        <Select
          label={t('expenses.categoryLabel')}
          value={draft.category}
          onChange={(e) => {
            const category = e.target.value
            if (category !== INVENTORY_PURCHASE_CATEGORY) {
              setDraft((d) => ({ ...d, category, linkedProductId: '', linkedQty: '', amountEdited: false }))
            } else {
              set('category', category)
            }
          }}
        >
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {expenseCategoryLabel(c)}
            </option>
          ))}
        </Select>
        {!editing && draft.category === INVENTORY_PURCHASE_CATEGORY && (
          <div className="grid grid-cols-2 gap-4">
            <Select label={t('expenses.linkedProductLabel')} value={draft.linkedProductId} onChange={(e) => handleLinkedProductChange(e.target.value)}>
              <option value="">{t('expenses.noSpecificProduct')}</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
            {draft.linkedProductId && (
              <Input
                label={t('expenses.linkedQuantityLabel')}
                type="number"
                mono
                value={draft.linkedQty}
                onChange={(e) => handleLinkedQtyChange(e.target.value)}
                min="1"
              />
            )}
          </div>
        )}
        <Input
          label={t('expenses.descriptionLabel')}
          value={draft.description}
          onChange={(e) => set('description', e.target.value)}
          placeholder={t('expenses.descriptionPlaceholder')}
        />
        <div className={editing?.productId ? 'grid grid-cols-2 gap-4' : ''}>
          {draft.vendorMode === 'other' ? (
            <Input
              label={t('expenses.vendorLabel')}
              value={draft.vendor}
              onChange={(e) => set('vendor', e.target.value)}
              placeholder={t('expenses.vendorPlaceholder')}
            />
          ) : (
            <Select
              label={t('expenses.vendorLabel')}
              value={draft.vendor}
              onChange={(e) => {
                const val = e.target.value
                if (val === ADD_NEW_SUPPLIER_VALUE) {
                  navigate('/suppliers?new=1&fromExpense=1')
                  return
                }
                if (val === OTHER_VENDOR_VALUE) {
                  setDraft((d) => ({ ...d, vendorMode: 'other', vendor: '' }))
                  return
                }
                set('vendor', val)
              }}
            >
              <option value="">{t('expenses.noVendor')}</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name}
                </option>
              ))}
              <option value={OTHER_VENDOR_VALUE}>{t('expenses.otherVendorOption')}</option>
              <option value={ADD_NEW_SUPPLIER_VALUE}>{t('expenses.addNewSupplierOption')}</option>
            </Select>
          )}
          {editing?.productId && (
            <Input label={t('expenses.linkedQuantityLabel')} type="number" mono value={editing.quantityAffected ?? ''} disabled readOnly />
          )}
        </div>
        <Textarea label={t('expenses.notesLabel')} value={draft.notes} onChange={(e) => set('notes', e.target.value)} rows={2} />
      </div>
      <DialogActions onCancel={onClose} onConfirm={handleSave} confirmLabel={editing ? t('expenses.saveChanges') : t('expenses.addExpense')} />
    </Dialog>
  )
}
