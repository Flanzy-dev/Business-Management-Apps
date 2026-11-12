import type { Expense } from '../../store/expenseStore'
import { formatCurrency } from '../../lib/format/numbers'
import { formatDate } from '../../lib/format/dates'
import { expenseCategoryLabel } from '../../lib/format/entities'
import { rowEditOnDoubleClick } from '../../lib/app/rowInteraction'
import { useTranslation } from '../../lib/i18n'
import { useIncrementalList } from '../../hooks/useIncrementalList'
import { RowActions } from '../ui/RowActions'
import { ShowMoreFooter } from '../ui/ShowMoreFooter'

/** The expense list table — double-click a row (or use its row actions) to edit. */
export function ExpenseTable({
  expenses,
  onEdit,
  onDelete,
}: {
  expenses: Expense[]
  onEdit: (expense: Expense) => void
  onDelete: (id: string) => void
}) {
  const { t } = useTranslation()
  // Expenses only ever accumulate, so this is the one table here that grows
  // without bound. The caller filters first; only the mounted slice is capped.
  const list = useIncrementalList(expenses, `${expenses.length}|${expenses[0]?.id ?? ''}`)
  return (
    <>
    <div className="bg-surface-card border border-border-2 rounded-radius-md overflow-auto max-h-[70vh]">
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
          {list.visible.map((e) => (
            <tr key={e.id} {...rowEditOnDoubleClick(() => onEdit(e))} className="border-t border-border-subtle hover:bg-surface-sunken">
              <td className="p-3 font-mono text-sm text-text-secondary tabular-nums">{formatDate(e.date)}</td>
              <td className="p-3">
                <span className="px-2 py-1 bg-surface-sunken rounded-radius-sm text-sm text-text-secondary">{expenseCategoryLabel(e.category)}</span>
              </td>
              <td className="p-3 text-text-primary">{e.description}</td>
              <td className="p-3 text-center font-mono text-text-secondary tabular-nums">{e.quantityAffected ?? '-'}</td>
              <td className="p-3 text-text-secondary">{e.vendor || '-'}</td>
              <td className="p-3 text-right font-mono font-medium text-text-primary tabular-nums">{formatCurrency(e.amount)}</td>
              <td className="p-3 text-right">
                <RowActions onEdit={() => onEdit(e)} onDelete={() => onDelete(e.id)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <ShowMoreFooter shown={list.shown} total={list.total} onShowMore={list.showMore} />
    </>
  )
}
