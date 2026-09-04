import { HardHat, ShieldCheck, RotateCcw } from 'lucide-react'
import { useTranslation } from '../../lib/i18n'

/** LockScreen's initial "choose" step: Worker (always offered), Admin (only
 *  when this device may use it), and the restore-recovery entry point (only
 *  when there's something to recover into). */
export function ModeChooser({
  onEnterWorker,
  canUseAdmin,
  onOpenAdmin,
  canRestore,
  onOpenRestore,
}: {
  onEnterWorker: () => void
  canUseAdmin: boolean
  onOpenAdmin: () => void
  canRestore: boolean
  onOpenRestore: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="space-y-3">
      <button
        onClick={onEnterWorker}
        className="w-full flex items-center gap-3 p-4 bg-surface-card border border-border-2 rounded-radius-md hover:border-border-3 transition-colors text-left focus-ring"
      >
        <div className="w-10 h-10 rounded-full bg-bg-3 flex items-center justify-center flex-shrink-0">
          <HardHat size={20} className="text-fg-2" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-fg-1">{t('auth.lockScreen.workerButton')}</p>
          <p className="text-xs text-fg-3">{t('auth.lockScreen.workerButtonHint')}</p>
        </div>
      </button>

      {canUseAdmin ? (
        <button
          onClick={onOpenAdmin}
          className="w-full flex items-center gap-3 p-4 bg-surface-card border border-border-2 rounded-radius-md hover:border-border-3 transition-colors text-left focus-ring"
        >
          <div className="w-10 h-10 rounded-full bg-bg-3 flex items-center justify-center flex-shrink-0">
            <ShieldCheck size={20} className="text-fg-2" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-fg-1">{t('auth.lockScreen.adminButton')}</p>
            <p className="text-xs text-fg-3">{t('auth.lockScreen.adminButtonHint')}</p>
          </div>
        </button>
      ) : (
        <p className="text-2xs text-fg-3 text-center px-2 leading-relaxed">{t('auth.lockScreen.adminNotHereNote')}</p>
      )}

      {canRestore && (
        <button
          onClick={onOpenRestore}
          className="w-full flex items-center gap-2 justify-center text-xs text-fg-3 hover:text-fg-2 transition-colors py-1"
        >
          <RotateCcw size={13} />
          {t('auth.lockScreen.restoreEntryLabel')}
        </button>
      )}
    </div>
  )
}
