import { CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react'
import { useToastStore } from '../../store/toastStore'

const toneConfig = {
  neutral: { icon: Info, text: 'text-fg-2', border: 'border-l-border-3' },
  success: { icon: CheckCircle2, text: 'text-success', border: 'border-l-success' },
  danger: { icon: XCircle, text: 'text-danger', border: 'border-l-danger' },
  warning: { icon: AlertTriangle, text: 'text-warning', border: 'border-l-warning' },
}

export function ToastHost() {
  const { toast, dismiss } = useToastStore()

  if (!toast) return null

  const { icon: Icon, text, border } = toneConfig[toast.tone]

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-6 right-6 z-[100] w-[340px] bg-bg-3 border border-border-2 border-l-2 ${border} rounded-radius-md shadow-md p-4 overlay-toast-enter`}
    >
      <div className="flex items-start gap-2.5">
        <Icon size={16} className={`mt-0.5 flex-shrink-0 ${text}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-fg-1">{toast.title}</p>
          {toast.description && <p className="text-xs text-fg-2 mt-0.5">{toast.description}</p>}
        </div>
        {toast.action && (
          <button
            onClick={() => {
              toast.action?.onClick()
              dismiss()
            }}
            className="text-xs font-medium text-accent flex-shrink-0 focus-ring"
          >
            {toast.action.label}
          </button>
        )}
      </div>
    </div>
  )
}
