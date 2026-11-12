import type { FormEvent } from 'react'
import { useTranslation } from '../../lib/i18n'
import { Dialog, DialogFooter } from '../ui/Dialog'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { useRequiredFields } from '../../hooks/useRequiredFields'

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
  existing = null,
  onUseExisting,
}: {
  open: boolean
  name: string
  phone: string
  onNameChange: (value: string) => void
  onPhoneChange: (value: string) => void
  onBack: () => void
  onSave: () => void
  /** Someone on file already has the phone number typed. */
  existing?: { id: string; name: string } | null
  onUseExisting?: (customerId: string) => void
}) {
  const { t } = useTranslation()
  const { errors, validate, clear } = useRequiredFields<'name'>()
  return (
    <Dialog closeOnScrimClick={false} open={open} onClose={onBack} title={t('workOrders.addNewCustomerTitle')} size="sm">
      {/* A form so Enter saves, like every other step of a new order. */}
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault()
          if (validate({ name })) onSave()
        }}
      >
        <div className="space-y-4">
          <Input label={t('workOrders.customerNameLabel')} value={name} onChange={(e) => { onNameChange(e.target.value); clear('name') }} aria-required="true" error={errors.name} />
          <Input label={t('workOrders.customerPhoneLabel')} value={phone} onChange={(e) => onPhoneChange(e.target.value)} />
          {existing && onUseExisting && (
            <div role="status" className="flex items-center gap-3 rounded-radius-sm border border-warning bg-warning-muted px-3 py-2 text-sm">
              <p className="min-w-0 flex-1 text-fg-1">{t('workOrders.phoneAlreadyCustomer', { name: existing.name })}</p>
              <Button variant="secondary" size="sm" type="button" onClick={() => onUseExisting(existing.id)}>
                {t('workOrders.useExistingCustomer', { name: existing.name })}
              </Button>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" type="button" onClick={onBack}>
            {t('common.back')}
          </Button>
          <Button variant="primary" type="submit">
            {t('common.save')}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
