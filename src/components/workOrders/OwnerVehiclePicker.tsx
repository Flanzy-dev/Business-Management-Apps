import type { Vehicle } from '../../store/vehicleStore'
import { useTranslation } from '../../lib/i18n'
import { Select } from '../ui/Input'

const ADD_NEW = '__add_new__'

/**
 * The vehicle picker for whichever owner is selected — a Select when the
 * owner has vehicles on file, or an inline "no vehicles yet" prompt with an
 * add-new link when they don't. `ownerVehicles` is expected pre-filtered and
 * pre-sorted (default vehicle first) by the caller.
 */
export function OwnerVehiclePicker({
  ownerType,
  ownerVehicles,
  vehicleId,
  onSelectVehicle,
  onAddNew,
}: {
  ownerType: 'customer' | 'company'
  ownerVehicles: Vehicle[]
  vehicleId: string
  onSelectVehicle: (vehicleId: string) => void
  onAddNew: () => void
}) {
  const { t } = useTranslation()
  return (
    <div>
      <label className="block text-2xs uppercase font-semibold tracking-wide text-fg-3 mb-1.5">{t('workOrders.vehicleLabel')}</label>
      {ownerVehicles.length === 0 ? (
        <div className="flex items-center gap-3">
          <p className="text-text-secondary text-sm">
            {ownerType === 'customer' ? t('workOrders.noVehiclesForCustomer') : t('workOrders.noVehiclesForCompany')}
          </p>
          <button type="button" onClick={onAddNew} className="text-accent text-sm hover:underline">
            {t('workOrders.addNewVehicle')}
          </button>
        </div>
      ) : (
        <Select
          value={vehicleId}
          onChange={(e) => {
            const v = e.target.value
            if (v === ADD_NEW) {
              onAddNew()
              return
            }
            onSelectVehicle(v)
          }}
        >
          <option value="">{t('workOrders.selectVehicle')}</option>
          {ownerVehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.year} {v.make} {v.model} - {v.licensePlate}
            </option>
          ))}
          <option value={ADD_NEW}>{t('workOrders.addNewVehicleEllipsis')}</option>
        </Select>
      )}
    </div>
  )
}
