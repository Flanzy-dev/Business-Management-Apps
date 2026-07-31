import { useState } from 'react'
import { Vehicle, useVehicleStore } from '../../store/vehicleStore'
import { validateVIN, validateLicensePlate, formatVIN, formatLicensePlate } from '../../lib/validators'
import { decodeVin } from '../../lib/vinDecode'
import { vinDecodeSummary } from '../../lib/entities'
import { useTranslation } from '../../lib/i18n'
import { Dialog, DialogFooter } from '../ui/Dialog'
import { Input, Select, Textarea } from '../ui/Input'
import { Button } from '../ui/Button'

export function VehicleModal({
  vehicle,
  customers,
  companies,
  initialOwnerType,
  initialCustomerId,
  initialCompanyId,
  onSave,
  onClose,
}: {
  vehicle: Vehicle | null
  customers: { id: string; name: string }[]
  companies: { id: string; companyName: string }[]
  initialOwnerType?: 'customer' | 'company'
  initialCustomerId?: string
  initialCompanyId?: string
  onSave: (data: Omit<Vehicle, 'id' | 'createdAt'>, scheduleMode: 'workshop_default' | 'custom') => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const vehicles = useVehicleStore(s => s.vehicles)
  const [ownerType, setOwnerType] = useState<'customer' | 'company'>(
    vehicle?.companyId ? 'company' : (initialOwnerType ?? 'customer')
  )
  const [customerId, setCustomerId] = useState(vehicle?.customerId ?? initialCustomerId ?? '')
  const [companyId, setCompanyId] = useState(vehicle?.companyId ?? initialCompanyId ?? '')
  const [setAsDefault, setSetAsDefault] = useState(false)
  // Only meaningful when creating — governs whether handleSave auto-seeds
  // ScheduleRules from the catalog defaults or opens Manage Schedule instead.
  const [scheduleMode, setScheduleMode] = useState<'workshop_default' | 'custom'>('workshop_default')

  // Only meaningful when creating — an edit never changes default status here
  // (that's the Vehicles list's "Set as default" row action instead).
  const ownerId = ownerType === 'customer' ? customerId : companyId
  const ownerHasVehicles = !!ownerId && vehicles.some(v =>
    ownerType === 'customer' ? v.customerId === ownerId : v.companyId === ownerId
  )

  const [make, setMake] = useState(vehicle?.make ?? '')
  const [model, setModel] = useState(vehicle?.model ?? '')
  const [year, setYear] = useState(vehicle?.year?.toString() ?? '')
  const [vin, setVin] = useState(vehicle?.vin ?? '')
  const [vinError, setVinError] = useState<string | undefined>()
  const [licensePlate, setLicensePlate] = useState(vehicle?.licensePlate ?? '')
  const [plateError, setPlateError] = useState<string | undefined>()
  const [color, setColor] = useState(vehicle?.color ?? '')
  const [currentMileage, setCurrentMileage] = useState(vehicle?.currentMileage?.toString() ?? '')

  const [engineType, setEngineType] = useState(vehicle?.engineType ?? '')
  const [engineSize, setEngineSize] = useState(vehicle?.engineSize ?? '')
  const [oilTypeRequired, setOilTypeRequired] = useState(vehicle?.oilTypeRequired ?? '')
  const [oilCapacity, setOilCapacity] = useState(vehicle?.oilCapacity ?? '')

  const [transmissionType, setTransmissionType] = useState(vehicle?.transmissionType ?? '')
  const [transmissionFluidType, setTransmissionFluidType] = useState(vehicle?.transmissionFluidType ?? '')

  const [driveType, setDriveType] = useState(vehicle?.driveType ?? '')
  const [differentialFluidType, setDifferentialFluidType] = useState(vehicle?.differentialFluidType ?? '')

  const [notes, setNotes] = useState(vehicle?.notes ?? '')

  const handleVinChange = (value: string) => {
    const formatted = formatVIN(value)
    setVin(formatted)
    const validation = validateVIN(formatted)
    setVinError(validation.error)
  }

  // Offline best-effort decode (see lib/vinDecode.ts) — cheap enough to
  // recompute on every render rather than needing an effect.
  const decoded = vin.length === 17 ? decodeVin(vin) : null

  // Only ever fills a field that's currently blank — never overwrites what
  // the tech already typed or what an existing vehicle already had.
  const applyDecodedVin = () => {
    if (!decoded) return
    if (decoded.manufacturer && !make) setMake(decoded.manufacturer)
    if (decoded.modelYear && !year) setYear(String(decoded.modelYear))
  }

  const handlePlateChange = (value: string) => {
    const formatted = formatLicensePlate(value)
    setLicensePlate(formatted)
    const validation = validateLicensePlate(formatted)
    setPlateError(validation.error)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!make.trim() || !model.trim()) return

    // Check for validation errors
    const vinValidation = validateVIN(vin)
    const plateValidation = validateLicensePlate(licensePlate)
    if (!vinValidation.valid || !plateValidation.valid) {
      setVinError(vinValidation.error)
      setPlateError(plateValidation.error)
      return
    }

    onSave({
      customerId: ownerType === 'customer' ? customerId || null : null,
      companyId: ownerType === 'company' ? companyId || null : null,
      make,
      model,
      year: year ? parseInt(year) : null,
      vin,
      licensePlate,
      color,
      currentMileage: currentMileage ? parseInt(currentMileage) : null,
      engineType,
      engineSize,
      oilTypeRequired,
      oilCapacity,
      transmissionType,
      transmissionFluidType,
      driveType,
      differentialFluidType,
      notes,
      // Only set on create — an edit omits the key entirely so updateVehicle's
      // partial merge leaves whatever default status the vehicle already had.
      ...(vehicle ? {} : { isDefault: !ownerHasVehicles || setAsDefault }),
    }, scheduleMode)
  }

  return (
    <Dialog open onClose={onClose} title={vehicle ? t('vehicles.editTitle') : t('vehicles.addTitle')} size="xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-surface-sunken p-4 rounded-radius-sm">
            <label className="block text-2xs uppercase font-semibold tracking-wide text-fg-3 mb-2">{t('vehicles.ownerLabel')}</label>
            <div className="flex gap-4 mb-3">
              <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                <input
                  type="radio"
                  checked={ownerType === 'customer'}
                  onChange={() => setOwnerType('customer')}
                  className="accent-accent"
                />
                {t('vehicles.individualCustomer')}
              </label>
              <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                <input
                  type="radio"
                  checked={ownerType === 'company'}
                  onChange={() => setOwnerType('company')}
                  className="accent-accent"
                />
                {t('vehicles.companyFleet')}
              </label>
            </div>
            {ownerType === 'customer' ? (
              <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">{t('vehicles.selectCustomerPlaceholder')}</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            ) : (
              <Select value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
                <option value="">{t('vehicles.selectCompanyPlaceholder')}</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.companyName}</option>
                ))}
              </Select>
            )}
            {!vehicle && ownerId && (
              ownerHasVehicles ? (
                <label className="mt-2 flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={setAsDefault}
                    onChange={(e) => setSetAsDefault(e.target.checked)}
                    className="accent-accent"
                  />
                  {t('vehicles.setAsDefaultLabel')}
                </label>
              ) : (
                <p className="mt-2 text-xs text-fg-3">{t('vehicles.firstVehicleDefaultHint')}</p>
              )
            )}
          </div>

          {!vehicle && (
            <div className="bg-surface-sunken p-4 rounded-radius-sm">
              <label className="block text-2xs uppercase font-semibold tracking-wide text-fg-3 mb-2">
                {t('vehicles.scheduleSetupLabel')}
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                  <input
                    type="radio"
                    checked={scheduleMode === 'workshop_default'}
                    onChange={() => setScheduleMode('workshop_default')}
                    className="accent-accent"
                  />
                  {t('vehicles.scheduleModeWorkshopDefault')}
                </label>
                <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                  <input
                    type="radio"
                    checked={scheduleMode === 'custom'}
                    onChange={() => setScheduleMode('custom')}
                    className="accent-accent"
                  />
                  {t('vehicles.scheduleModeCustom')}
                </label>
              </div>
              <p className="mt-2 text-xs text-fg-3">
                {scheduleMode === 'workshop_default' ? t('vehicles.scheduleModeWorkshopDefaultHint') : t('vehicles.scheduleModeCustomHint')}
              </p>
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-3">{t('vehicles.basicInformationHeading')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <Input label={t('vehicles.makeLabel')} value={make} onChange={(e) => setMake(e.target.value)} placeholder="Toyota" required />
              <Input label={t('vehicles.modelLabel')} value={model} onChange={(e) => setModel(e.target.value)} placeholder="Camry" required />
              <Input label={t('vehicles.yearLabel')} type="number" mono value={year} onChange={(e) => setYear(e.target.value)} placeholder="2020" />
              <Input label={t('vehicles.colorLabel')} value={color} onChange={(e) => setColor(e.target.value)} placeholder="Silver" />
              <Input
                label={t('vehicles.licensePlateLabel')}
                mono
                value={licensePlate}
                onChange={(e) => handlePlateChange(e.target.value)}
                placeholder="B 1234 XYZ"
                error={plateError}
              />
              <div>
                <Input
                  label={t('vehicles.vinFieldLabel')}
                  mono
                  value={vin}
                  onChange={(e) => handleVinChange(e.target.value)}
                  placeholder="1HGBH41JXMN109186"
                  error={vinError}
                />
                {!vinError && vin && vin.length < 17 && (
                  <p className="text-xs text-text-secondary mt-1">{t('vehicles.vinCharCount', { count: vin.length })}</p>
                )}
                {decoded && vinDecodeSummary(decoded) && (
                  <p className="mt-1 text-xs text-fg-3">
                    {vinDecodeSummary(decoded)}
                    {((decoded.manufacturer && !make) || (decoded.modelYear && !year)) && (
                      <button type="button" onClick={applyDecodedVin} className="ml-2 text-accent hover:underline">
                        {t('vehicles.vinApplyDecoded')}
                      </button>
                    )}
                  </p>
                )}
              </div>
              <Input label={t('vehicles.currentMileageLabel')} type="number" mono value={currentMileage} onChange={(e) => setCurrentMileage(e.target.value)} placeholder="50000" />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-3">{t('vehicles.engineHeading')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <Select label={t('vehicles.engineTypeLabel')} value={engineType} onChange={(e) => setEngineType(e.target.value)}>
                <option value="">{t('vehicles.selectPlaceholder')}</option>
                <option value="Gasoline">{t('vehicles.engineGasoline')}</option>
                <option value="Diesel">{t('vehicles.engineDiesel')}</option>
                <option value="Hybrid">{t('vehicles.engineHybrid')}</option>
                <option value="Electric">{t('vehicles.engineElectric')}</option>
              </Select>
              <Input label={t('vehicles.engineSizeLabel')} value={engineSize} onChange={(e) => setEngineSize(e.target.value)} placeholder="2.5L, V6" />
              <Input label={t('vehicles.oilTypeRequiredLabel')} value={oilTypeRequired} onChange={(e) => setOilTypeRequired(e.target.value)} placeholder="5W-30, 0W-20" />
              <Input label={t('vehicles.oilCapacityLabel')} value={oilCapacity} onChange={(e) => setOilCapacity(e.target.value)} placeholder="4.5 L" />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-3">{t('vehicles.transmissionHeading')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <Select label={t('vehicles.transmissionTypeLabel')} value={transmissionType} onChange={(e) => setTransmissionType(e.target.value)}>
                <option value="">{t('vehicles.selectPlaceholder')}</option>
                <option value="Automatic">{t('vehicles.transmissionAutomatic')}</option>
                <option value="Manual">{t('vehicles.transmissionManual')}</option>
                <option value="CVT">{t('vehicles.transmissionCVT')}</option>
                <option value="ATF">{t('vehicles.transmissionATF')}</option>
              </Select>
              <Input label={t('vehicles.transmissionFluidTypeLabel')} value={transmissionFluidType} onChange={(e) => setTransmissionFluidType(e.target.value)} placeholder="ATF Type T-IV" />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-3">{t('vehicles.gardanHeading')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <Select label={t('vehicles.driveTypeLabel')} value={driveType} onChange={(e) => setDriveType(e.target.value)}>
                <option value="">{t('vehicles.selectPlaceholder')}</option>
                <option value="FWD">{t('vehicles.driveFWD')}</option>
                <option value="RWD">{t('vehicles.driveRWD')}</option>
                <option value="AWD">{t('vehicles.driveAWD')}</option>
                <option value="4WD">{t('vehicles.drive4WD')}</option>
              </Select>
              <Input label={t('vehicles.differentialFluidTypeLabel')} value={differentialFluidType} onChange={(e) => setDifferentialFluidType(e.target.value)} placeholder="75W-90" />
            </div>
          </div>

          <Textarea label={t('vehicles.notesLabel')} value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />

          <DialogFooter>
            <Button variant="ghost" type="button" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" type="submit">
              {vehicle ? t('vehicles.saveChanges') : t('vehicles.addVehicle')}
            </Button>
          </DialogFooter>
        </form>
    </Dialog>
  )
}
