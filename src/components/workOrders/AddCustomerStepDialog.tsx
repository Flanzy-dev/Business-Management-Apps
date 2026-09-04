import { useTranslation } from '../../lib/i18n'
import { Dialog, DialogFooter } from '../ui/Dialog'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'

/**
 * The "+ Add new customer" inline detour off NewWorkOrderDialog's owner
 * Select — a company/fleet "add new" still navigates away to Companies.tsx,
 * but an individual customer is common and quick enough to handle without
 * losing the order form underneath. Purely presentational: all the fields
 * are controlled by the parent, which also owns what happens on save.
 */
export function AddCustomerStepDialog({
  open,
  name,
  phone,
  onNameChange,
  onPhoneChange,
  onBack,
  onSave,
}: {
  open: boolean
  name: string
  phone: string
  onNameChange: (value: string) => void
  onPhoneChange: (value: string) => void
  onBack: () => void
  onSave: () => void
}) {
  const { t } = useTranslation()
  return (
    <Dialog open={open} onClose={onBack} title={t('workOrders.addNewCustomerTitle')} size="sm">
      <div className="space-y-4">
        <Input label={t('workOrders.customerNameLabel')} value={name} onChange={(e) => onNameChange(e.target.value)} required />
        <Input label={t('workOrders.customerPhoneLabel')} value={phone} onChange={(e) => onPhoneChange(e.target.value)} />
      </div>
      <DialogFooter>
        <Button variant="ghost" type="button" onClick={onBack}>
          {t('common.back')}
        </Button>
        <Button variant="primary" onClick={onSave} disabled={!name.trim()}>
          {t('common.save')}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
