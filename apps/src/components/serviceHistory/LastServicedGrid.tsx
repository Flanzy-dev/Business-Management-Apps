import type { LastServicedEntry } from '../../lib/vehicles/vehicleServiceHistory'
import { formatDistance } from '../../lib/format/numbers'
import { formatDate } from '../../lib/format/dates'
import { serviceItemTypeLabel } from '../../lib/format/entities'
import { useTranslation } from '../../lib/i18n'

/** When each tracked item (engine oil, oil filter, …) was last done on a
 *  vehicle, and at what odometer. Renders nothing when there's no record. */
export function LastServicedGrid({ entries, className = '' }: { entries: LastServicedEntry[]; className?: string }) {
  const { t } = useTranslation()
  if (entries.length === 0) return null
  return (
    <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 ${className}`}>
      {entries.map(({ itemType, date, odometer }) => (
        <div key={itemType.id}>
          <p className="text-caption">{t('serviceHistory.lastItemPrefix', { item: serviceItemTypeLabel(itemType.name) })}</p>
          <p className="text-text-primary text-sm">
            {formatDate(date)}
            {odometer != null && ` · ${formatDistance(odometer)}`}
          </p>
        </div>
      ))}
    </div>
  )
}
