import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Check, MoreVertical, LucideIcon } from 'lucide-react'
import { useTranslation } from '../../lib/i18n'
import { useDismissOnOutside } from '../../hooks/useDismissOnOutside'

export interface DropdownMenuItem {
  label: string
  icon?: LucideIcon
  onClick: () => void
  variant?: 'default' | 'danger'
  /** Renders a checkmark on this item — for a single-select list (e.g. a
   *  category filter) rather than an action menu. */
  selected?: boolean
}

interface DropdownMenuProps {
  items: DropdownMenuItem[]
  /** Custom trigger instead of the default "..." icon button — e.g. a
   *  labeled filter button. Receives the click handler to open/close the menu. */
  trigger?: (props: { onClick: () => void; open: boolean }) => React.ReactNode
  /** Which edge of the trigger the menu's own edge lines up with. The default
   *  "..." button right-aligns (matches a row's trailing action icon); a
   *  wider labeled trigger usually reads better left-aligned. */
  align?: 'left' | 'right'
}

export function DropdownMenu({ items, trigger, align = 'right' }: DropdownMenuProps) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const [openUpward, setOpenUpward] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  // A div, not the default button itself, so a custom `trigger` (whatever it
  // renders) can still be measured for positioning the same way.
  const buttonRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useDismissOnOutside(isOpen, () => setIsOpen(false), [buttonRef, dropdownRef])

  const handleToggle = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const shouldOpenUpward = spaceBelow < 200

      setOpenUpward(shouldOpenUpward)
      setPosition({
        top: shouldOpenUpward ? rect.top : rect.bottom + 4,
        left: align === 'left' ? rect.left : rect.right - 140,
      })
    }
    setIsOpen(!isOpen)
  }

  const handleItemClick = (item: DropdownMenuItem) => {
    item.onClick()
    setIsOpen(false)
  }

  const dropdownContent = (
    <div
      ref={dropdownRef}
      style={{
        position: 'fixed',
        top: openUpward ? 'auto' : position.top,
        bottom: openUpward ? window.innerHeight - position.top + 4 : 'auto',
        left: position.left,
        zIndex: 9999,
      }}
      className={`min-w-[140px] bg-surface-card border border-border-subtle rounded-radius-sm shadow-lg py-1 ${
        openUpward ? 'overlay-menu-enter-up' : 'overlay-menu-enter-down'
      }`}
    >
      {items.map((item, index) => {
        const Icon = item.icon
        return (
          <button
            key={index}
            type="button"
            onClick={() => handleItemClick(item)}
            className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition-colors ${
              item.variant === 'danger'
                ? 'text-danger hover:bg-danger-muted'
                : 'text-text-primary hover:bg-surface-sunken'
            }`}
          >
            {Icon && <Icon size={16} />}
            <span className="flex-1">{item.label}</span>
            {item.selected && <Check size={16} className="text-accent shrink-0" />}
          </button>
        )
      })}
    </div>
  )

  return (
    <div ref={buttonRef} className="relative inline-block">
      {trigger ? (
        trigger({ onClick: handleToggle, open: isOpen })
      ) : (
        <button
          type="button"
          onClick={handleToggle}
          // The visible/painted square stays 30x30 (p-1.5 around an 18px
          // icon) so dense tables don't get a bloated hover square — but the
          // actual tap TARGET is widened to 44px with a transparent ::before
          // (30 + 2*7 = 44), the invariant sizing note in
          // src/lib/rowInteraction.ts's callers being: row pitch must stay
          // >=44px or two rows' expanded hit areas overlap and a tap near a
          // row's bottom edge silently acts on the row below it instead —
          // every current call site already clears that.
          className="relative before:absolute before:content-[''] before:-inset-[7px] p-1.5 rounded-radius-sm text-text-secondary hover:text-text-primary hover:bg-surface-sunken transition-colors"
          aria-label={t('common.actions')}
        >
          <MoreVertical size={18} />
        </button>
      )}

      {isOpen && createPortal(dropdownContent, document.body)}
    </div>
  )
}
