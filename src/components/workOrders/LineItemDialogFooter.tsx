import { useTranslation } from '../../lib/i18n'
import { DialogFooter } from '../ui/Dialog'
import { Button } from '../ui/Button'

export function LineItemDialogFooter({
  mode,
  onRemove,
  onClose,
  onSave,
  canSave,
}: {
  mode: 'custom' | 'edit'
  onRemove?: () => void
  onClose: () => void
  onSave: () => void
  canSave: boolean
}) {
  const { t } = useTranslation()

  return (
    <DialogFooter>
      {mode === 'edit' && onRemove && (
        <Button variant="danger" type="button" onClick={onRemove} className="mr-auto">
          {t('workOrders.removeAction')}
        </Button>
      )}
      <Button variant="ghost" type="button" onClick={onClose}>
        {t('common.cancel')}
      </Button>
      <Button variant="primary" onClick={onSave} disabled={!canSave}>
        {mode === 'custom' ? t('common.add') : t('common.save')}
      </Button>
    </DialogFooter>
  )
}
