import type { SupplierDraft } from '../../lib/supplierForm'
import { useTranslation } from '../../lib/i18n'
import { Dialog, DialogActions } from '../ui/Dialog'
import { Input, Textarea } from '../ui/Input'

export function SupplierFormDialog({
  open,
  editing,
  draft,
  onChange,
  onClose,
  onSave,
}: {
  open: boolean
  editing: boolean
  draft: SupplierDraft
  onChange: (fields: Partial<SupplierDraft>) => void
  onClose: () => void
  onSave: () => void
}) {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onClose={onClose} title={editing ? t('suppliers.editTitle') : t('suppliers.addTitle')}>
      <div className="space-y-4">
        <Input label={t('suppliers.nameLabel')} value={draft.name} onChange={e => onChange({ name: e.target.value })} />
        <Input label={t('suppliers.phoneLabel')} type="tel" value={draft.phone} onChange={e => onChange({ phone: e.target.value })} />
        <Input label={t('suppliers.emailLabel')} type="email" value={draft.email} onChange={e => onChange({ email: e.target.value })} />
        <Input label={t('suppliers.addressLabel')} value={draft.address} onChange={e => onChange({ address: e.target.value })} />
        <Textarea label={t('suppliers.notesLabel')} value={draft.notes} onChange={e => onChange({ notes: e.target.value })} rows={2} />
      </div>
      <DialogActions onCancel={onClose} onConfirm={onSave} confirmLabel={editing ? t('suppliers.saveChanges') : t('suppliers.addSupplier')} />
    </Dialog>
  )
}
