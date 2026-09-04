import { Car, User, ClipboardList, Calendar, Gauge, Droplet, Clock } from 'lucide-react'
import type { ServiceItemType } from '../store/serviceItemTypeStore'
import { formatDistance } from '../lib/units'
import { formatDate } from '../lib/dates'
import { vehicleLabel, serviceItemTypeLabel } from '../lib/entities'
import { dueStatusLabel } from '../lib/vehicleDueSummary'
import type { SearchResult } from '../lib/globalSearch'
import { useTranslation } from '../lib/i18n'

const RESULT_ICON: Record<SearchResult['type'], typeof Car> = {
  vehicle: Car,
  customer: User,
  workorder: ClipboardList,
}

function resultTitle(result: SearchResult): string {
  switch (result.type) {
    case 'vehicle': return vehicleLabel(result.vehicle)
    case 'customer': return result.name
    case 'workorder': return `SB-${result.orderNumber}`
  }
}

function resultSubtitle(result: SearchResult, t: (key: string) => string): string {
  switch (result.type) {
    case 'vehicle':
      return `${result.vehicle.licensePlate || t('globalSearch.noPlate')} • ${result.ownerName || t('globalSearch.noOwner')}`
    case 'customer':
      return result.phone || t('globalSearch.noPhone')
    case 'workorder':
      return result.vehicle ? vehicleLabel(result.vehicle) : t('globalSearch.unknownVehicle')
  }
}

// Only overdue/due-soon is worth a warning-styled callout in a compact
// palette row — same "worth surfacing" bar src/lib/reminders.ts's
// getVehicleReminders uses; an on-track vehicle has nothing to warn about.
function dueLabel(result: SearchResult): string | null {
  if (result.type !== 'vehicle') return null
  if (result.dueStatus.kind !== 'scheduled' || result.dueStatus.tone === 'on_track') return null
  return dueStatusLabel(result.dueStatus)
}

function oilTypeLabel(result: SearchResult, serviceItemTypes: ServiceItemType[]): string | null {
  if (result.type !== 'vehicle' || !result.serviceItemTypeId) return null
  const itemType = serviceItemTypes.find((it) => it.id === result.serviceItemTypeId)
  return itemType ? serviceItemTypeLabel(itemType.name) : null
}

/** One search result — a title/subtitle line, plus (vehicles only) a
 *  last-service/oil-type/due-status detail grid when there's anything to show. */
export function SearchResultRow({
  result,
  selected,
  serviceItemTypes,
  onSelect,
}: {
  result: SearchResult
  selected: boolean
  serviceItemTypes: ServiceItemType[]
  onSelect: () => void
}) {
  const { t } = useTranslation()
  const Icon = RESULT_ICON[result.type]
  const oilType = oilTypeLabel(result, serviceItemTypes)
  const due = dueLabel(result)
  const typeLabel =
    result.type === 'vehicle' ? t('globalSearch.typeVehicle') : result.type === 'customer' ? t('globalSearch.typeCustomer') : t('globalSearch.typeWorkorder')

  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors ${
        selected ? 'bg-accent/20 text-accent' : 'text-text-primary hover:bg-surface-sunken'
      }`}
    >
      <div className={`w-8 h-8 rounded-radius-sm flex items-center justify-center shrink-0 mt-0.5 ${selected ? 'bg-accent/20' : 'bg-surface-sunken'}`}>
        <Icon size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{resultTitle(result)}</div>
        <div className="text-caption truncate">{resultSubtitle(result, t)}</div>

        {result.type === 'vehicle' && (result.lastServiceAt || oilType) && (
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
            {result.lastServiceAt && (
              <div className="flex items-center gap-1.5 text-caption">
                <Calendar size={12} className="text-text-secondary" />
                <span>{t('globalSearch.lastPrefix', { date: formatDate(result.lastServiceAt) })}</span>
              </div>
            )}
            {result.odometerAtLastService != null && (
              <div className="flex items-center gap-1.5 text-caption">
                <Gauge size={12} className="text-text-secondary" />
                <span>{formatDistance(result.odometerAtLastService)}</span>
              </div>
            )}
            {oilType && (
              <div className="flex items-center gap-1.5 text-caption">
                <Droplet size={12} className="text-text-secondary" />
                <span className="truncate">{oilType}</span>
              </div>
            )}
            {due && (
              <div className="flex items-center gap-1.5 text-caption">
                <Clock size={12} className="text-warning" />
                <span className="text-warning">{t('globalSearch.duePrefix', { status: due })}</span>
              </div>
            )}
          </div>
        )}
      </div>
      <span className="text-caption shrink-0">{typeLabel}</span>
    </button>
  )
}
