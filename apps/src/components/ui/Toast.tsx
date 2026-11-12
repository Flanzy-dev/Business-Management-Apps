import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { useToastStore } from '../../store/uiStores'
import { useTranslation } from '../../lib/i18n'

const toneConfig = {
  neutral: { icon: Info, text: 'text-fg-2', border: 'border-l-border-3' },
  success: { icon: CheckCircle2, text: 'text-success', border: 'border-l-success' },
  danger: { icon: XCircle, text: 'text-danger', border: 'border-l-danger' },
  warning: { icon: AlertTriangle, text: 'text-warning', border: 'border-l-warning' },
}

export function ToastHost() {
  const { toast } = useToastStore()
  const assertive = toast?.tone === 'danger'

  // Both live regions stay mounted and the toast renders into one of them:
  // a region that appears together with its message is often not announced.
  // Errors interrupt (assertive); confirmations wait their turn (polite).
  // Top-centre, under the top bar: bottom-right sat over the order ticket's
  // Charge button exactly when stock warnings pop up.
  return (
    <>
      <div role="status" aria-live="polite" className={REGION}>
        {toast && !assertive && <ToastCard />}
      </div>
      <div role="alert" aria-live="assertive" className={REGION}>
        {toast && assertive && <ToastCard />}
      </div>
    </>
  )
}

const REGION = 'fixed inset-x-0 top-16 z-[100] flex justify-center px-4 pointer-events-none'

function ToastCard() {
  const { t } = useTranslation()
  const { toast, dismiss, pause, resume } = useToastStore()
  if (!toast) return null
  const { icon: Icon, text, border } = toneConfig[toast.tone]

  return (
    <div
      // The countdown holds while the reader's pointer is over the toast or
      // keyboard focus is inside it (WCAG 2.2.1 timing adjustable).
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocus={pause}
      onBlur={resume}
      className={`pointer-events-auto w-[340px] max-w-full bg-bg-3 border border-border-2 border-l-2 ${border} rounded-radius-md shadow-md p-4 overlay-toast-enter`}
    >
      <div className="flex items-start gap-2.5">
        <Icon size={16} className={`mt-0.5 flex-shrink-0 ${text}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-fg-1">{toast.title}</p>
          {toast.description && <p className="text-xs text-fg-2 mt-0.5">{toast.description}</p>}
        </div>
        {toast.action && (
          <button
            type="button"
            // Dismiss first: the action may show a toast of its own (an Undo
            // that is refused), which a dismiss after it would wipe.
            onClick={() => {
              const action = toast.action
              dismiss()
              action?.onClick()
            }}
            className="text-xs font-medium text-accent flex-shrink-0 rounded-radius-xs focus-ring coarse:min-h-[44px] coarse:px-2"
          >
            {toast.action.label}
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          aria-label={t('common.close')}
          title={t('common.close')}
          className="flex-shrink-0 -mr-1 -mt-0.5 p-1 rounded-radius-xs text-fg-3 hover:text-fg-1 transition-colors focus-ring coarse:min-h-[44px] coarse:min-w-[44px] coarse:flex coarse:items-center coarse:justify-center"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
