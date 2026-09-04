import { Pencil, Trash2 } from 'lucide-react'
import { DropdownMenu, DropdownMenuItem } from './DropdownMenu'
import { useTranslation } from '../../lib/i18n'

/**
 * The Edit/Delete pair every entity table's row menu ends with — was
 * hand-duplicated at 9 call sites, several with their own page-specific items
 * ahead of it (a service-history shortcut, a reconcile action, a "set as
 * default" toggle). `leadingItems` covers those without forcing every
 * dropdown into the same fixed shape; WorkOrderList.tsx's status-dependent
 * menu (edit XOR nothing, delete XOR void) doesn't fit this pattern at all
 * and keeps its own inline `DropdownMenu`.
 */
export function RowActions({
  leadingItems,
  onEdit,
  onDelete,
}: {
  leadingItems?: DropdownMenuItem[]
  onEdit: () => void
  onDelete: () => void
}) {
  const { t } = useTranslation()
  return (
    <DropdownMenu
      items={[
        ...(leadingItems ?? []),
        { label: t('common.edit'), icon: Pencil, onClick: onEdit },
        { label: t('common.delete'), icon: Trash2, onClick: onDelete, variant: 'danger' },
      ]}
    />
  )
}
