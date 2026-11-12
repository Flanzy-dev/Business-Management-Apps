import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Tabs } from '../ui/Tabs'
import { resolveTab, withTab } from '../../lib/app/navigation'

export interface PageTab {
  value: string
  label: string
  render: () => ReactNode
}

/**
 * One sidebar item holding several sections as tabs — Customers · Companies,
 * Appointments · Reminders, Products · Services · Suppliers. Each section is
 * the page it used to be, with its own header and main action, rendered under
 * a row of tabs. The active tab is `?tab=` (src/lib/app/navigation.ts), so the old
 * paths in ROUTE_ALIASES and links from other pages land on the right one.
 *
 * `tabs` must already be filtered to what this mode may see: a tab left out
 * can't be reached by URL either, it falls back to the first tab.
 */
export function TabbedPage({ tabs }: { tabs: PageTab[] }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const active = resolveTab(
    searchParams,
    tabs.map((tab) => tab.value),
    tabs[0].value
  )
  const current = tabs.find((tab) => tab.value === active) ?? tabs[0]

  return (
    <div>
      <Tabs
        className="mb-6"
        variant="pill"
        value={active}
        onChange={(value) => setSearchParams(withTab(value))}
        tabs={tabs.map(({ value, label }) => ({ value, label }))}
      />
      {/* Keyed so switching tabs starts the section fresh (its search box,
          open dialogs), as navigating between the old pages did. */}
      <div key={current.value}>{current.render()}</div>
    </div>
  )
}
