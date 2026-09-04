import { Car } from 'lucide-react'
import type { Vehicle } from '../../store/vehicleStore'
import { useTranslation } from '../../lib/i18n'

/** ServiceHistory's Quick-Find-style results list under the search box. */
export function VehicleSearchResults({
  query,
  vehicles,
  getOwnerLabel,
  onSelect,
}: {
  query: string
  vehicles: Vehicle[]
  getOwnerLabel: (vehicle: Vehicle) => string
  onSelect: (vehicle: Vehicle) => void
}) {
  const { t, tc } = useTranslation()

  if (vehicles.length === 0) {
    return <p className="text-text-secondary text-sm">{t('serviceHistory.noVehiclesFound', { query })}</p>
  }

  return (
    <div className="space-y-2">
      <p className="text-caption mb-2">{tc('serviceHistory.vehiclesFound', vehicles.length)}</p>
      {vehicles.map((v) => (
        <button
          key={v.id}
          onClick={() => onSelect(v)}
          className="w-full flex items-center gap-4 p-3 bg-surface-sunken rounded-radius-sm text-left hover:border-accent border border-transparent transition-colors"
        >
          <Car size={20} className="text-text-secondary" />
          <div className="flex-1">
            <div className="text-text-primary font-medium">
              {v.year} {v.make} {v.model}
            </div>
            <div className="text-caption">
              <span className="font-mono">{v.licensePlate || t('serviceHistory.noPlate')}</span>
              {v.vin && <span className="ml-3 font-mono">VIN: {v.vin}</span>}
            </div>
          </div>
          <span className="text-text-secondary text-sm">{getOwnerLabel(v)}</span>
        </button>
      ))}
    </div>
  )
}
