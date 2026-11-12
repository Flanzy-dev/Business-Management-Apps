import { useId, useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import type { Vehicle } from '../../store/vehicleStore'
import type { Customer } from '../../store/customerStore'
import type { Company } from '../../store/companyStore'
import { quickFindVehicles, type QuickFindResult } from '../../lib/orders/newOrderForm'
import { useTranslation } from '../../lib/i18n'
import { Input } from '../ui/Input'

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
  onAddNew,
}: {
  vehicles: Vehicle[]
  customers: Customer[]
  companies: Company[]
  onSelect: (result: QuickFindResult) => void
  /** Nothing on file matches — start a new customer and vehicle, carrying
   *  what was typed (usually the plate) into the vehicle form. */
  onAddNew?: (query: string) => void
}) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)

  const listId = useId()
  // Re-ranked per keystroke, not per render: the dialog re-renders for every
  // field edit, and this scans every vehicle on file.
  const noPlateLabel = t('globalSearch.noPlate')
  const results = useMemo(
    () => quickFindVehicles(query, vehicles, customers, companies, noPlateLabel),
    [query, vehicles, customers, companies, noPlateLabel]
  )

  const canAddNew = !!onAddNew && query.trim().length >= 2 && results.length === 0
  const addNew = () => {
    onAddNew?.(query.trim())
    setQuery('')
  }

  const select = (r: QuickFindResult) => {
    onSelect(r)
    setQuery('')
    setHighlight(0)
  }

  return (
    <div className="relative">
      <Input
        label={t('workOrders.quickFindLabel')}
        type="text"
        leadingIcon={Search}
        role="combobox"
        aria-expanded={results.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={results.length > 0 ? `${listId}-${highlight}` : undefined}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setHighlight(0)
        }}
        onKeyDown={(e) => {
          // Enter on a search that found nothing starts adding that car,
          // rather than falling through to submit the order form.
          if (e.key === 'Enter' && results.length === 0 && canAddNew) {
            e.preventDefault()
            addNew()
            return
          }
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
        trailing={query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label={t('globalSearch.clearSearch')}
            className="text-fg-3 hover:text-fg-1 rounded-radius-xs focus-ring coarse:min-h-[44px] coarse:min-w-[44px] coarse:flex coarse:items-center coarse:justify-center"
          >
            <X size={16} />
          </button>
        )}
      />
      {results.length > 0 && (
        <div id={listId} role="listbox" aria-label={t('workOrders.quickFindLabel')} className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto bg-surface-card border border-border-2 rounded-radius-sm shadow-lg">
          {results.map((r, i) => (
            <button
              key={r.vehicleId}
              id={`${listId}-${i}`}
              type="button"
              role="option"
              aria-selected={i === highlight}
              // Focus stays in the search box; arrows and Enter drive the list.
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => select(r)}
              className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors focus-ring ${
                i === highlight ? 'bg-accent-muted text-accent' : 'text-text-primary hover:bg-surface-sunken'
              }`}
            >
              <span className="font-mono text-sm shrink-0">{r.plate}</span>
              <span className="text-sm truncate flex-1" title={r.vehicleLabel}>{r.vehicleLabel}</span>
              <span className="text-caption shrink-0">{r.ownerLabel}</span>
            </button>
          ))}
        </div>
      )}
      {query.trim().length >= 2 && results.length === 0 && (
        <p className="mt-1.5 text-xs text-fg-3">
          {t('workOrders.quickFindNoResults')}
          {canAddNew && (
            <button type="button" onClick={addNew} className="ml-2 text-accent hover:underline rounded-radius-xs focus-ring">
              {t('workOrders.quickFindAddNew', { query: query.trim() })}
            </button>
          )}
        </p>
      )}
    </div>
  )
}
