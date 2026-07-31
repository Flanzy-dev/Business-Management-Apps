import { Dialog, DialogFooter } from './Dialog'
import { Button } from './Button'
import { useTranslation } from '../../lib/i18n'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'primary'
  onConfirm: () => void
  onClose: () => void
}

/**
 * Themed replacement for window.confirm — used for destructive actions.
 * Confirm is the last focusable so Tab order reads Cancel → Confirm.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  tone = 'danger',
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const { t } = useTranslation()
  return (
    <Dialog open={open} onClose={onClose} title={title} size="sm">
      <p>{message}</p>
      <DialogFooter>
        <Button variant="ghost" size="sm" onClick={onClose}>
          {cancelLabel ?? t('common.cancel')}
        </Button>
        <Button
          variant={tone === 'danger' ? 'danger' : 'primary'}
          size="sm"
          onClick={() => {
            onConfirm()
            onClose()
          }}
        >
          {confirmLabel ?? t('common.delete')}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
