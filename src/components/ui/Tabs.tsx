type TabItem = string | { value: string; label: string; count?: number }

interface TabsProps {
  tabs: TabItem[]
  value: string
  onChange: (value: string) => void
  className?: string
  /** 'underline' (default) for in-page section switches; 'pill' for
   * top-level page navigation (e.g. Reports' report-type switcher). */
  variant?: 'underline' | 'pill'
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
    return `px-4 py-2 rounded-radius-sm transition-colors ${
      isActive
        ? 'bg-accent text-surface-canvas'
        : 'bg-surface-sunken text-text-secondary hover:text-text-primary border border-border-subtle'
    }`
  }
  return `
    flex items-center gap-2 h-9 -mb-px px-1
    border-b-2 transition-colors duration-fast ease-out
    ${isActive ? 'border-accent text-fg-1 font-semibold' : 'border-transparent text-fg-3 hover:text-fg-2'}
  `
}

export function Tabs({ tabs, value, onChange, className = '', variant = 'underline' }: TabsProps) {
  return (
    <div className={`${CONTAINER[variant]} ${className}`}>
      {tabs.map((raw) => {
        const tab = normalize(raw)
        const isActive = tab.value === value
        return (
          <button key={tab.value} onClick={() => onChange(tab.value)} className={tabClass(variant, isActive)}>
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
