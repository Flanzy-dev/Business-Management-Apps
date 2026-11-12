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
        {/* md, not sm — DialogFormActions (Dialog.tsx) passes no size at all
            for the Cancel/Save pair used by every other dialog's footer,
            i.e. md (34px); this was the app's only dialog footer at 28px,
            including its destructive Delete/confirm button. touch (44px)
            would be louder than every other dialog footer and risks
            wrapping with longer Indonesian labels — a deliberate "all dialog
            footers" decision that belongs outside this pass. */}
        <Button variant="ghost" size="md" onClick={onClose}>
          {cancelLabel ?? t('common.cancel')}
        </Button>
        <Button
          variant={tone === 'danger' ? 'danger' : 'primary'}
          size="md"
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
