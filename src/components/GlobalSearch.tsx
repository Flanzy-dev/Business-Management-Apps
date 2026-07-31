import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Car, User, ClipboardList, X, Calendar, Gauge, Droplet, Clock } from 'lucide-react'
import { useCustomerStore } from '../store/customerStore'
import { useVehicleStore } from '../store/vehicleStore'
import { useWorkOrderStore } from '../store/workOrderStore'
import { formatDistance } from '../lib/units'
import { vehicleLabel } from '../lib/entities'
import { useTranslation } from '../lib/i18n'

interface GlobalSearchProps {
  open: boolean
  onClose: () => void
}

type SearchResult = {
  type: 'vehicle' | 'customer' | 'workorder'
  id: string
  title: string
  subtitle: string
  route: string
  // Enhanced vehicle info
  lastServiceDate?: string
  mileageAtLastVisit?: number
  oilType?: string
  nextDueEstimate?: string
}

export default function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  const { customers } = useCustomerStore()
  const { vehicles } = useVehicleStore()
  const { workOrders } = useWorkOrderStore()

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

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
  }, [open, selectedIndex, query])

  const results: SearchResult[] = []

  if (query.length >= 2) {
    const q = query.toLowerCase()

    // Search vehicles by plate or VIN
    vehicles.forEach(v => {
      const plateMatch = v.licensePlate?.toLowerCase().includes(q)
      const vinMatch = v.vin?.toLowerCase().includes(q)
      if (plateMatch || vinMatch) {
        const customer = customers.find(c => c.id === v.customerId)

        // Find last completed work order for this vehicle
        const vehicleWorkOrders = workOrders
          .filter(wo => wo.vehicleId === v.id && wo.status === 'completed')
          .sort((a, b) => new Date(b.completedAt || b.createdAt).getTime() - new Date(a.completedAt || a.createdAt).getTime())

        const lastWorkOrder = vehicleWorkOrders[0]

        // Extract service info from last work order
        let lastServiceDate: string | undefined
        let mileageAtLastVisit: number | undefined
        let oilType: string | undefined
        let nextDueEstimate: string | undefined

        if (lastWorkOrder) {
          const serviceDate = new Date(lastWorkOrder.completedAt || lastWorkOrder.createdAt)
          lastServiceDate = serviceDate.toLocaleDateString()

          // Get mileage if available (from work order or vehicle record)
          mileageAtLastVisit = (lastWorkOrder as any).mileage || v.currentMileage

          // Try to find oil type from work order items
          const oilItem = lastWorkOrder.items.find(item =>
            item.description.toLowerCase().includes('oil') ||
            item.description.toLowerCase().includes('synthetic')
          )
          oilType = oilItem?.description.split(' - ')[0] || undefined

          // Calculate next due estimate (3 months from last service)
          const nextDue = new Date(serviceDate)
          nextDue.setMonth(nextDue.getMonth() + 3)
          nextDueEstimate = nextDue.toLocaleDateString()
        }

        results.push({
          type: 'vehicle',
          id: v.id,
          title: vehicleLabel(v),
          subtitle: `${v.licensePlate || t('globalSearch.noPlate')} • ${customer?.name || t('globalSearch.noOwner')}`,
          route: '/vehicles',
          lastServiceDate,
          mileageAtLastVisit,
          oilType,
          nextDueEstimate,
        })
      }
    })

    // Search customers by name or phone
    customers.forEach(c => {
      const nameMatch = c.name.toLowerCase().includes(q)
      const phoneMatch = c.phone?.toLowerCase().includes(q)
      if (nameMatch || phoneMatch) {
        results.push({
          type: 'customer',
          id: c.id,
          title: c.name,
          subtitle: c.phone || t('globalSearch.noPhone'),
          route: '/customers',
        })
      }
    })

    // Search work orders by order number
    workOrders.forEach(wo => {
      const orderMatch = wo.orderNumber?.toString().includes(q)
      if (orderMatch) {
        const vehicle = vehicles.find(v => v.id === wo.vehicleId)
        results.push({
          type: 'workorder',
          id: wo.id,
          title: `SB-${wo.orderNumber}`,
          subtitle: vehicle ? vehicleLabel(vehicle) : t('globalSearch.unknownVehicle'),
          route: '/work-orders',
        })
      }
    })
  }

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  const handleSelect = (result: SearchResult) => {
    navigate(result.route)
    onClose()
  }

  const getIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'vehicle': return Car
      case 'customer': return User
      case 'workorder': return ClipboardList
    }
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
          {query.length < 2 ? (
            <div className="px-4 py-8 text-center text-text-secondary text-sm">
              {t('globalSearch.typeToSearch')}
            </div>
          ) : results.length === 0 ? (
            <div className="px-4 py-8 text-center text-text-secondary text-sm">
              {t('globalSearch.noResultsFound', { query })}
            </div>
          ) : (
            <div className="py-2">
              {results.map((result, index) => {
                const Icon = getIcon(result.type)
                return (
                  <button
                    key={`${result.type}-${result.id}`}
                    onClick={() => handleSelect(result)}
                    className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors ${
                      index === selectedIndex
                        ? 'bg-accent/20 text-accent'
                        : 'text-text-primary hover:bg-surface-sunken'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-radius-sm flex items-center justify-center shrink-0 mt-0.5 ${
                      index === selectedIndex ? 'bg-accent/20' : 'bg-surface-sunken'
                    }`}>
                      <Icon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{result.title}</div>
                      <div className="text-caption truncate">{result.subtitle}</div>

                      {/* Enhanced vehicle info */}
                      {result.type === 'vehicle' && (result.lastServiceDate || result.oilType) && (
                        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                          {result.lastServiceDate && (
                            <div className="flex items-center gap-1.5 text-caption">
                              <Calendar size={12} className="text-text-secondary" />
                              <span>{t('globalSearch.lastPrefix', { date: result.lastServiceDate })}</span>
                            </div>
                          )}
                          {result.mileageAtLastVisit && (
                            <div className="flex items-center gap-1.5 text-caption">
                              <Gauge size={12} className="text-text-secondary" />
                              <span>{formatDistance(result.mileageAtLastVisit)}</span>
                            </div>
                          )}
                          {result.oilType && (
                            <div className="flex items-center gap-1.5 text-caption">
                              <Droplet size={12} className="text-text-secondary" />
                              <span className="truncate">{result.oilType}</span>
                            </div>
                          )}
                          {result.nextDueEstimate && (
                            <div className="flex items-center gap-1.5 text-caption">
                              <Clock size={12} className="text-warning" />
                              <span className="text-warning">{t('globalSearch.duePrefix', { date: result.nextDueEstimate })}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <span className="text-caption shrink-0">
                      {result.type === 'vehicle' ? t('globalSearch.typeVehicle') : result.type === 'customer' ? t('globalSearch.typeCustomer') : t('globalSearch.typeWorkorder')}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
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
