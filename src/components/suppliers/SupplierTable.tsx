import type { Supplier } from '../../store/supplierStore'
import { rowEditOnDoubleClick } from '../../lib/rowInteraction'
import { useTranslation } from '../../lib/i18n'
import { RowActions } from '../ui/RowActions'

export function SupplierTable({
  suppliers,
  onEdit,
  onDelete,
}: {
  suppliers: Supplier[]
  onEdit: (s: Supplier) => void
  onDelete: (id: string) => void
}) {
  const { t } = useTranslation()

  return (
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
          {suppliers.map(s => (
            <tr key={s.id} {...rowEditOnDoubleClick(() => onEdit(s))} className="border-t border-border-subtle hover:bg-surface-sunken">
              <td className="p-3 font-medium text-text-primary">{s.name}</td>
              <td className="p-3 text-text-secondary">{s.phone || '-'}</td>
              <td className="p-3 text-text-secondary">{s.email || '-'}</td>
              <td className="p-3 text-sm text-text-secondary">{s.address || '-'}</td>
              <td className="p-3 text-right">
                <RowActions onEdit={() => onEdit(s)} onDelete={() => onDelete(s.id)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
