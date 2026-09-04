import type { Driver } from '../../store/companyStore'
import { useTranslation } from '../../lib/i18n'
import { Select } from '../ui/Input'

const ADD_NEW = '__add_new__'

/**
 * The optional driver picker for a company/fleet order — a Select when the
 * company has drivers on file, or an inline "no drivers yet" prompt with an
 * add-new link when it doesn't. Same shape as OwnerVehiclePicker.
 */
export function DriverPicker({
  drivers,
  driverId,
  onSelectDriver,
  onAddNew,
}: {
  drivers: Driver[]
  driverId: string
  onSelectDriver: (driverId: string) => void
  onAddNew: () => void
}) {
  const { t } = useTranslation()
  return (
    <div>
      <label className="block text-2xs uppercase font-semibold tracking-wide text-fg-3 mb-1.5">{t('workOrders.driverOptionalLabel')}</label>
      {drivers.length === 0 ? (
        <div className="flex items-center gap-3">
          <p className="text-text-secondary text-sm">{t('workOrders.noDriversForCompany')}</p>
          <button type="button" onClick={onAddNew} className="text-accent text-sm hover:underline">
            {t('workOrders.addNewDriver')}
          </button>
        </div>
      ) : (
        <Select
          value={driverId}
          onChange={(e) => {
            const v = e.target.value
            if (v === ADD_NEW) {
              onAddNew()
              return
            }
            onSelectDriver(v)
          }}
        >
          <option value="">{t('workOrders.selectDriver')}</option>
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
          <option value={ADD_NEW}>{t('workOrders.addNewDriverEllipsis')}</option>
        </Select>
      )}
    </div>
  )
}
