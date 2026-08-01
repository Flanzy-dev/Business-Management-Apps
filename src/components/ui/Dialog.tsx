import { ReactNode, useEffect, useId, useRef } from 'react'
import { X } from 'lucide-react'
import { IconButton } from './IconButton'
import { useTranslation } from '../../lib/i18n'

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

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function Dialog({ open, onClose, children, title, size = 'md' }: DialogProps) {
  const titleId = useId()
  const { t } = useTranslation()
  const panelRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)
  // Always-latest ref so the effect below doesn't need `onClose` in its
  // deps — call sites pass an inline arrow function that gets a new
  // identity every render, and re-running this effect on every keystroke
  // would re-steal focus to the first field (see Dialog.tsx bug notes).
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return

    // Remember the opener so focus can return to it on close.
    openerRef.current = document.activeElement as HTMLElement | null
    // Move focus into the dialog body (not the header): first focusable
    // control there, else the panel itself. Scoped to the body so the header
    // close (✕) button — which sits before the body in DOM order — never
    // steals initial focus from the first form field.
    const panel = panelRef.current
    const first = bodyRef.current?.querySelector<HTMLElement>(FOCUSABLE)
    ;(first ?? panel)?.focus()

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current()
        return
      }
      // Trap Tab inside the panel.
      if (e.key === 'Tab' && panel) {
        const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
        if (focusables.length === 0) {
          e.preventDefault()
          return
        }
        const firstEl = focusables[0]
        const lastEl = focusables[focusables.length - 1]
        const active = document.activeElement
        if (e.shiftKey && (active === firstEl || active === panel)) {
          e.preventDefault()
          lastEl.focus()
        } else if (!e.shiftKey && active === lastEl) {
          e.preventDefault()
          firstEl.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeydown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeydown)
      document.body.style.overflow = ''
      openerRef.current?.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onClose read via onCloseRef so this effect only re-runs on open/close, not on every parent render
  }, [open])

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
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={`relative w-full ${sizeStyles[size]} bg-surface-card border border-border-2 rounded-radius-lg shadow-lg max-h-[85vh] overflow-y-auto`}
      >
        {title && (
          <div className="flex items-center justify-between px-5 pt-5">
            <h2 id={titleId} className="font-display text-lg font-[540] text-fg-1">{title}</h2>
            <IconButton label={t('common.close')} onClick={onClose}>
              <X size={18} />
            </IconButton>
          </div>
        )}
        <div ref={bodyRef} className="px-5 pt-3 pb-5 text-sm text-fg-2 leading-normal">
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
