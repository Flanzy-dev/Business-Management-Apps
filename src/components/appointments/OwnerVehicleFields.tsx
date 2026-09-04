import type { Customer } from '../../store/customerStore'
import type { Company } from '../../store/companyStore'
import type { Vehicle } from '../../store/vehicleStore'
import { useTranslation } from '../../lib/i18n'
import { Select } from '../ui/Input'

/**
 * Owner picker + the vehicle picker it drives (or a "no vehicles on file"
 * pointer to the Vehicles page) — the pair only appears once an owner type
 * is chosen, and the vehicle half only once that owner has a vehicle to
 * pick. `ownerVehicles` is already filtered to the selected owner.
 */
export function OwnerVehicleFields({
  ownerType,
  ownerId,
  onOwnerIdChange,
  customers,
  companies,
  ownerVehicles,
  vehicleId,
  onVehicleIdChange,
}: {
  ownerType: 'customer' | 'company'
  ownerId: string
  onOwnerIdChange: (id: string) => void
  customers: Customer[]
  companies: Company[]
  ownerVehicles: Vehicle[]
  vehicleId: string
  onVehicleIdChange: (id: string) => void
}) {
  const { t } = useTranslation()

  return (
    <>
      <Select
        label={ownerType === 'customer' ? t('appointments.customerField') : t('appointments.companyField')}
        value={ownerId}
        onChange={(e) => onOwnerIdChange(e.target.value)}
      >
        <option value="">
          {ownerType === 'customer' ? t('appointments.selectCustomer') : t('appointments.selectCompany')}
        </option>
        {ownerType === 'customer'
          ? customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)
          : companies.map((c) => <option key={c.id} value={c.id}>{c.companyName}</option>)}
      </Select>

      {ownerId && (
        ownerVehicles.length === 0 ? (
          <p className="text-sm text-text-secondary">
            {t('appointments.ownerHasNoVehicles')}{' '}
            <a href="#/vehicles" className="text-accent hover:underline">{t('appointments.goToVehicles')}</a>
          </p>
        ) : (
          <Select label={t('appointments.vehicleField')} value={vehicleId} onChange={(e) => onVehicleIdChange(e.target.value)}>
            <option value="">{t('appointments.selectVehicle')}</option>
            {ownerVehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {[v.year, v.make, v.model].filter(Boolean).join(' ')}{v.licensePlate ? ` — ${v.licensePlate}` : ''}
              </option>
            ))}
          </Select>
        )
      )}
    </>
  )
}
