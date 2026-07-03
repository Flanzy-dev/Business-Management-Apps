import { ReactNode, useEffect } from 'react'
import { X } from 'lucide-react'
import { IconButton } from './IconButton'

interface DialogProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  title?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const sizeStyles = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
}

export function Dialog({ open, onClose, children, title, size = 'md' }: DialogProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (open) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Scrim */}
      <div
        className="absolute inset-0 bg-overlay-scrim backdrop-blur-[8px]"
        style={{ backgroundColor: 'var(--overlay-scrim)', backdropFilter: 'blur(var(--blur-overlay))' }}
        onClick={onClose}
      />

      {/* Panel */}
      <div className={`relative w-full ${sizeStyles[size]} bg-surface-card border border-border-2 rounded-radius-lg shadow-lg max-h-[85vh] overflow-y-auto`}>
        {title && (
          <div className="flex items-center justify-between px-5 pt-5">
            <h2 className="font-display text-lg font-semibold text-fg-1">{title}</h2>
            <IconButton label="Close" onClick={onClose}>
              <X size={18} />
            </IconButton>
          </div>
        )}
        <div className="px-5 pt-3 pb-5 text-sm text-fg-2 leading-normal">
          {children}
        </div>
      </div>
    </div>
  )
}

export function DialogFooter({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`flex justify-end gap-3 mt-4 pt-3 px-5 pb-3 -mx-5 -mb-5 border-t border-border-1 ${className}`}>
      {children}
    </div>
  )
}
