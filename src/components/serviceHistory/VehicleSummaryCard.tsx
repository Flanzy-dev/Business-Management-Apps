import { Car, User } from 'lucide-react'
import type { Vehicle } from '../../store/vehicleStore'
import type { LastServicedEntry } from '../../lib/vehicleServiceHistory'
import { formatCurrency } from '../../lib/currency'
import { formatDistance } from '../../lib/units'
import { formatDate } from '../../lib/dates'
import { serviceItemTypeLabel } from '../../lib/entities'
import { useTranslation } from '../../lib/i18n'
import { StatTile } from '../ui/StatTile'

/** Which spec fields the card shows, in order — each just a label key and a
 *  getter, so a blank field (most vehicles don't have all four on file)
 *  drops out of the grid instead of leaving an empty cell. */
const SPEC_FIELDS: { labelKey: string; get: (v: Vehicle) => string }[] = [
  { labelKey: 'serviceHistory.oilType', get: (v) => v.oilTypeRequired },
  { labelKey: 'serviceHistory.oilCapacity', get: (v) => v.oilCapacity },
  { labelKey: 'serviceHistory.engine', get: (v) => v.engineSize },
  { labelKey: 'serviceHistory.transmission', get: (v) => v.transmissionType },
]

/**
 * ServiceHistory's vehicle info card: identity + owner, the visit/spend/
 * mileage stat tiles, spec fields the shop has on file, and the "last
 * serviced" summary per schedule tag.
 */
export function VehicleSummaryCard({
  vehicle,
  ownerLabel,
  canSeeMoney,
  totalVisits,
  totalSpent,
  lastServiced,
  onClear,
}: {
  vehicle: Vehicle
  ownerLabel: string
  canSeeMoney: boolean
  totalVisits: number
  totalSpent: number
  lastServiced: LastServicedEntry[]
  onClear: () => void
}) {
  const { t } = useTranslation()
  const specs = SPEC_FIELDS.map((f) => ({ ...f, value: f.get(vehicle) })).filter((f) => f.value)

  return (
    <div className="bg-surface-card rounded-radius-md p-6 mb-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-radius-sm bg-accent/20 flex items-center justify-center">
            <Car size={24} className="text-accent" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-text-primary">
              {vehicle.year} {vehicle.make} {vehicle.model}
            </h2>
            <div className="flex items-center gap-4 mt-1">
              <span className="text-text-secondary font-mono">{vehicle.licensePlate || t('serviceHistory.noPlate')}</span>
              {vehicle.vin && <span className="text-caption font-mono">VIN: {vehicle.vin}</span>}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <User size={14} className="text-text-secondary" />
              <span className="text-text-secondary text-sm">{ownerLabel}</span>
            </div>
          </div>
        </div>
        <button onClick={onClear} className="text-text-secondary hover:text-text-primary text-sm">
          {t('serviceHistory.clear')}
        </button>
      </div>

      {/* Stats */}
      <div className={`grid gap-4 mt-6 pt-6 border-t border-border-subtle ${canSeeMoney ? 'grid-cols-3' : 'grid-cols-2'}`}>
        <StatTile label={t('serviceHistory.totalVisits')} value={totalVisits} />
        {canSeeMoney && <StatTile label={t('serviceHistory.totalSpent')} value={formatCurrency(totalSpent)} />}
        <StatTile label={t('serviceHistory.currentMileage')} value={vehicle.currentMileage ? formatDistance(vehicle.currentMileage) : '-'} />
      </div>

      {/* Vehicle Specs. Was gated on just oilTypeRequired||engineSize (2 of
          the 4 fields rendered here) — a vehicle with only oilCapacity or
          transmissionType on file hid the whole block despite having
          something to show. Gating on "any field present" instead, same
          convention the last-serviced grid right below already uses. */}
      {specs.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-border-subtle">
          {specs.map((f) => (
            <div key={f.labelKey}>
              <p className="text-caption">{t(f.labelKey)}</p>
              <p className="text-text-primary text-sm">{f.value}</p>
            </div>
          ))}
        </div>
      )}

      {lastServiced.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-border-subtle">
          {lastServiced.map(({ itemType, date, odometer }) => (
            <div key={itemType.id}>
              <p className="text-caption">{t('serviceHistory.lastItemPrefix', { item: serviceItemTypeLabel(itemType.name) })}</p>
              <p className="text-text-primary text-sm">
                {formatDate(date)}
                {odometer != null && ` · ${formatDistance(odometer)}`}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
