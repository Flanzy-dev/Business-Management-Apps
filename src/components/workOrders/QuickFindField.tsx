import { useState } from 'react'
import { Search, X } from 'lucide-react'
import type { Vehicle } from '../../store/vehicleStore'
import type { Customer } from '../../store/customerStore'
import type { Company } from '../../store/companyStore'
import { quickFindVehicles, type QuickFindResult } from '../../lib/newOrderForm'
import { useTranslation } from '../../lib/i18n'

/**
 * Returning customers already know their plate, not which owner record it's
 * filed under — searching plate/VIN/owner-name across every vehicle at once
 * (like GlobalSearch, Ctrl+K) and picking owner+vehicle in one go is much
 * faster than the type→owner→vehicle picker, which stays as the fallback for
 * a vehicle staff can't recall by plate. Owns its own query/highlight state
 * and the arrow-key/Enter navigation — NewWorkOrderDialog only ever needs the
 * final pick.
 */
export function QuickFindField({
  vehicles,
  customers,
  companies,
  onSelect,
}: {
  vehicles: Vehicle[]
  customers: Customer[]
  companies: Company[]
  onSelect: (result: QuickFindResult) => void
}) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)

  const results = quickFindVehicles(query, vehicles, customers, companies, t('globalSearch.noPlate'))

  const select = (r: QuickFindResult) => {
    onSelect(r)
    setQuery('')
    setHighlight(0)
  }

  return (
    <div className="relative">
      <label className="block text-2xs uppercase font-semibold tracking-wide text-fg-3 mb-1.5">
        {t('workOrders.quickFindLabel')}
      </label>
      <div className="relative">
        <Search size={16} className="absolute left-[10px] top-1/2 -translate-y-1/2 text-fg-3 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setHighlight(0)
          }}
          onKeyDown={(e) => {
            if (results.length === 0) return
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setHighlight((i) => Math.min(i + 1, results.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setHighlight((i) => Math.max(i - 1, 0))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              select(results[highlight])
            }
          }}
          placeholder={t('workOrders.quickFindPlaceholder')}
          className="w-full h-[34px] pl-9 pr-9 bg-surface-input border border-border-2 rounded-radius-sm text-fg-1 text-sm placeholder-fg-3 focus:outline-none focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-muted)]"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label={t('globalSearch.clearSearch')}
            className="absolute right-[8px] top-1/2 -translate-y-1/2 text-fg-3 hover:text-fg-1 focus-ring"
          >
            <X size={16} />
          </button>
        )}
      </div>
      {results.length > 0 && (
        <div className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto bg-surface-card border border-border-2 rounded-radius-sm shadow-lg">
          {results.map((r, i) => (
            <button
              key={r.vehicleId}
              type="button"
              onClick={() => select(r)}
              className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                i === highlight ? 'bg-accent/20 text-accent' : 'text-text-primary hover:bg-surface-sunken'
              }`}
            >
              <span className="font-mono text-sm shrink-0">{r.plate}</span>
              <span className="text-sm truncate flex-1">{r.vehicleLabel}</span>
              <span className="text-caption shrink-0">{r.ownerLabel}</span>
            </button>
          ))}
        </div>
      )}
      {query.trim().length >= 2 && results.length === 0 && (
        <p className="mt-1.5 text-xs text-fg-3">{t('workOrders.quickFindNoResults')}</p>
      )}
    </div>
  )
}
