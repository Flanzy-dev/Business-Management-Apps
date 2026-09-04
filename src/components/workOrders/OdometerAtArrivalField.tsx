import type { Vehicle } from '../../store/vehicleStore'
import { formatDistance } from '../../lib/units'
import { useTranslation } from '../../lib/i18n'
import { Input } from '../ui/Input'

/** The odometer-at-arrival field, with a hint showing the vehicle's last
 *  known reading when it has one. `selectedVehicle` may be undefined while
 *  the vehicleId prop is still resolving (e.g. right after a Quick Find
 *  pick) — the hint simply doesn't render in that instant. */
export function OdometerAtArrivalField({
  value,
  onChange,
  selectedVehicle,
}: {
  value: string
  onChange: (value: string) => void
  selectedVehicle: Vehicle | undefined
}) {
  const { t } = useTranslation()
  return (
    <div>
      <Input
        type="number"
        label={t('workOrders.odometerAtArrivalLabel')}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={selectedVehicle?.currentMileage != null ? String(selectedVehicle.currentMileage) : undefined}
      />
      {selectedVehicle?.currentMileage != null && (
        <p className="mt-1 text-xs text-fg-3">
          {t('workOrders.lastKnownOdometerHint', { km: formatDistance(selectedVehicle.currentMileage) })}
        </p>
      )}
    </div>
  )
}
