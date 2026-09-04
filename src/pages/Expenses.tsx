import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useExpenseStore, EXPENSE_CATEGORIES, type Expense } from '../store/expenseStore'
import { deleteExpenseWithStockReversal } from '../lib/ops/inventoryOps'
import { parseNewEntityRequest } from '../lib/returnTrip'
import { useConfirmStore } from '../store/confirmStore'
import { filterExpenses } from '../lib/expenseForm'
import { formatCurrency } from '../lib/currency'
import { formatMonthYear, type DateLocale } from '../lib/dates'
import { expenseCategoryLabel } from '../lib/entities'
import { useTranslation } from '../lib/i18n'
import { Plus, Receipt } from 'lucide-react'
import { EmptyState } from '../components/ui/EmptyState'
import { Button } from '../components/ui/Button'
import { PageHeader } from '../components/ui/PageHeader'
import { Select } from '../components/ui/Input'
import { ExpenseFormDialog } from '../components/expenses/ExpenseFormDialog'
import { ExpenseTable } from '../components/expenses/ExpenseTable'

export default function Expenses() {
  const { t, tc, language } = useTranslation()
  const dateLocale: DateLocale = language === 'id' ? 'id-ID' : 'en-US'
  const { expenses, updateExpense } = useExpenseStore()
  const requestConfirm = useConfirmStore((s) => s.request)
  const [searchParams, setSearchParams] = useSearchParams()
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)
  const [pendingVendor, setPendingVendor] = useState<string | undefined>(undefined)
  const [filterCategory, setFilterCategory] = useState('')
  const [filterMonth, setFilterMonth] = useState('')

  const filtered = filterExpenses(expenses, filterCategory, filterMonth)
  const totalFiltered = filtered.reduce((sum, e) => sum + e.amount, 0)
  const months = [...new Set(expenses.map((e) => e.date.slice(0, 7)))].sort().reverse()

  const openCreate = () => {
    setEditing(null)
    setPendingVendor(undefined)
    setShowModal(true)
  }

  const openEdit = (e: Expense) => {
    setEditing(e)
    setShowModal(true)
  }

  // Arrival from Suppliers after "+ Add new supplier…" — reopen Add Expense
  // with the newly created supplier preselected as Vendor. Mirrors the
  // existing Work Order <-> Companies "add new driver" round trip.
  useEffect(() => {
    if (parseNewEntityRequest(searchParams).open) {
      setEditing(null)
      setPendingVendor(searchParams.get('vendor') || undefined)
      setShowModal(true)
      setSearchParams({}, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setSearchParams etc. are stable setters; only searchParams should retrigger this
  }, [searchParams])

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
            {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{expenseCategoryLabel(c)}</option>)}
          </Select>
        </div>
        <div className="w-48">
          <Select value={filterMonth} onChange={e => setFilterMonth(e.target.value)}>
            <option value="">{t('expenses.allTime')}</option>
            {months.map(m => (
              <option key={m} value={m}>
                {formatMonthYear(m + '-01', dateLocale)}
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
        <ExpenseTable expenses={filtered} onEdit={openEdit} onDelete={handleDelete} />
      )}

      <ExpenseFormDialog
        open={showModal}
        editing={editing}
        prefillVendor={pendingVendor}
        onClose={() => setShowModal(false)}
        onUpdate={updateExpense}
      />
    </div>
  )
}
