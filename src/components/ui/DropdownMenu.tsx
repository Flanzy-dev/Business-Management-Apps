import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { MoreVertical, LucideIcon } from 'lucide-react'

export interface DropdownMenuItem {
  label: string
  icon?: LucideIcon
  onClick: () => void
  variant?: 'default' | 'danger'
}

interface DropdownMenuProps {
  items: DropdownMenuItem[]
}

export function DropdownMenu({ items }: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [openUpward, setOpenUpward] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        buttonRef.current && !buttonRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false)
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  const handleToggle = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const shouldOpenUpward = spaceBelow < 200

      setOpenUpward(shouldOpenUpward)
      setPosition({
        top: shouldOpenUpward ? rect.top : rect.bottom + 4,
        left: rect.right - 140,
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
      className="min-w-[140px] bg-surface-card border border-border-subtle rounded-tile shadow-lg py-1"
    >
      {items.map((item, index) => {
        const Icon = item.icon
        return (
          <button
            key={index}
            onClick={() => handleItemClick(item)}
            className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition-colors ${
              item.variant === 'danger'
                ? 'text-accent-critical hover:bg-accent-critical/10'
                : 'text-text-primary hover:bg-surface-sunken'
            }`}
          >
            {Icon && <Icon size={16} />}
            {item.label}
          </button>
        )
      })}
    </div>
  )

  return (
    <div className="relative inline-block">
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className="p-1.5 rounded-tile text-text-secondary hover:text-text-primary hover:bg-surface-sunken transition-colors"
        aria-label="Actions"
      >
        <MoreVertical size={18} />
      </button>

      {isOpen && createPortal(dropdownContent, document.body)}
    </div>
  )
}
