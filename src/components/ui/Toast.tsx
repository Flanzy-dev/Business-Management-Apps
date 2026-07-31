import { useToastStore } from '../../store/toastStore'

const toneDotClass = {
  neutral: 'bg-fg-2',
  success: 'bg-success',
  danger: 'bg-danger',
  warning: 'bg-warning',
}

export function ToastHost() {
  const { toast, dismiss } = useToastStore()

  if (!toast) return null

  return (
    <div className="fixed bottom-6 right-6 z-[100] w-[340px] bg-bg-3 border border-border-2 rounded-radius-md shadow-md p-4">
      <div className="flex items-start gap-2.5">
        <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${toneDotClass[toast.tone]}`} />
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
            className="text-xs font-medium text-accent flex-shrink-0"
          >
            {toast.action.label}
          </button>
        )}
      </div>
    </div>
  )
}
