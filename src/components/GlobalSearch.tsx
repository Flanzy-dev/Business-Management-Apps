import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import { useCustomerStore } from '../store/customerStore'
import { useCompanyStore } from '../store/companyStore'
import { useVehicleStore } from '../store/vehicleStore'
import { useWorkOrderStore } from '../store/workOrderStore'
import { useScheduleRuleStore } from '../store/scheduleRuleStore'
import { useServiceItemTypeStore } from '../store/serviceItemTypeStore'
import { buildSearchResults, type SearchResult } from '../lib/globalSearch'
import { useTranslation } from '../lib/i18n'
import { useMode } from '../store/authStore'
import { canAccessRoute } from '../lib/auth/permissions'
import { SearchResultsPanel } from './SearchResultsPanel'

interface GlobalSearchProps {
  open: boolean
  onClose: () => void
}

export default function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  const { customers } = useCustomerStore()
  const { companies } = useCompanyStore()
  const { vehicles } = useVehicleStore()
  const { workOrders } = useWorkOrderStore()
  const scheduleRules = useScheduleRuleStore((s) => s.scheduleRules)
  const serviceItemTypes = useServiceItemTypeStore((s) => s.serviceItemTypes)
  const mode = useMode()

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  // Matching + per-vehicle due-date/last-service enrichment lives in
  // src/lib/globalSearch.ts (testable without React); this component only
  // formats the result into display strings and filters by route access.
  const results = useMemo(() => {
    const raw = buildSearchResults(query, { vehicles, customers, companies, workOrders, scheduleRules })
    // Filtered through the same canAccessRoute predicate as the route guard
    // and the sidebar nav (src/lib/auth/permissions.ts) — defensive today,
    // since every current result type already routes somewhere Worker mode
    // can reach, but keeps a future result type from being offered to a
    // worker before anyone remembers to check.
    return raw.filter((r) => canAccessRoute(mode, r.route))
  }, [query, vehicles, customers, companies, workOrders, scheduleRules, mode])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(i => Math.min(i + 1, results.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(i => Math.max(i - 1, 0))
      } else if (e.key === 'Enter' && results.length > 0) {
        e.preventDefault()
        handleSelect(results[selectedIndex])
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
    // `results` is recomputed each render from `query`; depending on query keeps
    // the handler's closure fresh (fixes stale results in Enter/ArrowDown).
  }, [open, selectedIndex, query, results])

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  const handleSelect = (result: SearchResult) => {
    navigate(result.route)
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 backdrop-blur-[8px]"
        style={{ backgroundColor: 'var(--overlay-scrim)' }}
        onClick={onClose}
      />

      {/* Search Panel */}
      <div className="relative w-full max-w-xl bg-surface-card rounded-radius-md border border-border-subtle shadow-2xl overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border-subtle">
          <Search size={20} className="text-text-secondary" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('globalSearch.placeholder')}
            className="flex-1 bg-transparent text-text-primary placeholder-text-secondary outline-none text-sm"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              aria-label={t('globalSearch.clearSearch')}
              className="text-text-secondary hover:text-text-primary focus-ring"
            >
              <X size={18} />
            </button>
          )}
          <kbd className="text-xs bg-surface-sunken px-2 py-0.5 rounded border border-border-subtle text-text-secondary">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          <SearchResultsPanel
            query={query}
            results={results}
            selectedIndex={selectedIndex}
            serviceItemTypes={serviceItemTypes}
            onSelect={handleSelect}
          />
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-border-subtle flex items-center gap-4 text-caption">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-surface-sunken rounded border border-border-subtle">↑</kbd>
            <kbd className="px-1.5 py-0.5 bg-surface-sunken rounded border border-border-subtle">↓</kbd>
            {t('globalSearch.toNavigate')}
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-surface-sunken rounded border border-border-subtle">↵</kbd>
            {t('globalSearch.toSelect')}
          </span>
        </div>
      </div>
    </div>
  )
}
