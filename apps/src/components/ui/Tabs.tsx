import { useRef, type KeyboardEvent } from 'react'

type TabItem = string | { value: string; label: string; count?: number }

interface TabsProps {
  tabs: TabItem[]
  value: string
  onChange: (value: string) => void
  className?: string
  /** 'underline' (default) for in-page section switches; 'pill' for
   * top-level page navigation (e.g. Reports' report-type switcher). */
  variant?: 'underline' | 'pill'
  /** Names the set for screen readers when nothing visible does (e.g. "Period"). */
  label?: string
}

function normalize(tab: TabItem): { value: string; label: string; count?: number } {
  return typeof tab === 'string' ? { value: tab, label: tab } : tab
}

const CONTAINER: Record<'underline' | 'pill', string> = {
  underline: 'flex gap-2 border-b border-border-1',
  pill: 'flex flex-wrap gap-2',
}

function tabClass(variant: 'underline' | 'pill', isActive: boolean): string {
  if (variant === 'pill') {
    return `px-4 py-2 coarse:py-3 text-sm rounded-radius-sm transition-colors focus-ring ${
      isActive
        ? 'bg-accent text-fg-inverse'
        : 'bg-surface-sunken text-text-secondary hover:text-text-primary border border-border-subtle'
    }`
  }
  return `
    flex items-center gap-2 h-9 coarse:h-11 -mb-px px-1 focus-ring
    border-b-2 transition-colors duration-fast ease-out
    ${isActive ? 'border-accent text-fg-1 font-semibold' : 'border-transparent text-fg-3 hover:text-fg-2'}
  `
}

export function Tabs({ tabs, value, onChange, className = '', variant = 'underline', label }: TabsProps) {
  const items = tabs.map(normalize)
  const buttons = useRef<(HTMLButtonElement | null)[]>([])

  // WAI-ARIA tabs: only the selected tab is in the Tab order; the arrow keys
  // (and Home/End) move between tabs and select as they go.
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = items.length - 1
    const next =
      e.key === 'ArrowRight' ? (index === last ? 0 : index + 1)
      : e.key === 'ArrowLeft' ? (index === 0 ? last : index - 1)
      : e.key === 'Home' ? 0
      : e.key === 'End' ? last
      : null
    if (next === null) return
    e.preventDefault()
    onChange(items[next].value)
    buttons.current[next]?.focus()
  }

  return (
    <div role="tablist" aria-label={label} className={`${CONTAINER[variant]} ${className}`}>
      {items.map((tab, index) => {
        const isActive = tab.value === value
        return (
          <button
            key={tab.value}
            ref={(el) => { buttons.current[index] = el }}
            type="button"
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onKeyDown={(e) => onKeyDown(e, index)}
            onClick={() => onChange(tab.value)}
            className={tabClass(variant, isActive)}
          >
            {variant === 'pill' ? (
              tab.label
            ) : (
              <span className="text-sm">{tab.label}</span>
            )}
            {tab.count !== undefined && (
              <span
                className={`font-mono text-2xs rounded-radius-full px-1.5 py-0.5 ${
                  isActive ? 'bg-accent-muted text-accent' : 'bg-bg-3 text-fg-3'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
