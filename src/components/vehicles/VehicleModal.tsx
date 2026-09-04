// Renders the add/edit-vehicle form and nothing else: which owner, what counts
// as valid, and how the fields become a Vehicle all live in
// src/lib/vehicleForm.ts, where they're testable (this component body isn't —
// see that module's header).
import { useState } from 'react'
import { Vehicle, useVehicleStore } from '../../store/vehicleStore'
import { useServiceItemTypeStore } from '../../store/serviceItemTypeStore'
import { useServiceCatalogStore } from '../../store/serviceCatalogStore'
import { formatVIN, formatLicensePlate, validateVIN, validateLicensePlate } from '../../lib/validators'
import {
  initialVehicleDraft,
  ownerHasVehicle,
  scheduleChoiceFromForm,
  scheduleSetupCandidates,
  initialScheduleSelection,
  toggleScheduleSelection,
  validateVehicleDraft,
  vehicleDraftToData,
  type ScheduleChoice,
  type ScheduleMode,
  type VehicleDraft,
} from '../../lib/vehicleForm'
import { decodeVin } from '../../lib/vinDecode'
import { vinDecodeSummary } from '../../lib/entities'
import { useTranslation } from '../../lib/i18n'
import { Dialog, DialogFooter } from '../ui/Dialog'
import { Input, Select, Textarea } from '../ui/Input'
import { Button } from '../ui/Button'
import { ScheduleRulesEditor } from './ScheduleRulesEditor'
import { NewVehicleScheduleFields } from './NewVehicleScheduleFields'

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
  onSave: (data: Omit<Vehicle, 'id' | 'createdAt'>, schedule: ScheduleChoice) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const vehicles = useVehicleStore(s => s.vehicles)
  const serviceItemTypes = useServiceItemTypeStore(s => s.serviceItemTypes)
  const services = useServiceCatalogStore(s => s.services)

  const [draft, setDraft] = useState<VehicleDraft>(() =>
    initialVehicleDraft(vehicle, {
      ownerType: initialOwnerType,
      customerId: initialCustomerId,
      companyId: initialCompanyId,
    })
  )
  // Only meaningful when creating — governs which ScheduleRules
  // Vehicles.tsx auto-seeds from the catalog defaults. Candidates are
  // recomputed every render (cheap, pure), but the ticked state itself is
  // seeded once at mount, same "seed the form once when the dialog opens"
  // convention `draft` above uses.
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>('workshop_default')
  const candidates = scheduleSetupCandidates(serviceItemTypes, services)
  const [selectedServiceIds, setSelectedServiceIds] = useState<Record<string, boolean>>(() =>
    initialScheduleSelection(candidates)
  )
  const [oilIntervalKmOverride, setOilIntervalKmOverride] = useState('')
  const [vinError, setVinError] = useState<string | undefined>()
  const [plateError, setPlateError] = useState<string | undefined>()
  const [oilIntervalError, setOilIntervalError] = useState<string | undefined>()

  const set = <K extends keyof VehicleDraft>(key: K, value: VehicleDraft[K]) =>
    setDraft(d => ({ ...d, [key]: value }))

  // Formatted as it's typed, then validated so the error shows immediately
  // rather than only on submit.
  const handleVinChange = (value: string) => {
    const formatted = formatVIN(value)
    set('vin', formatted)
    setVinError(validateVIN(formatted).error)
  }

  const handlePlateChange = (value: string) => {
    const formatted = formatLicensePlate(value)
    set('licensePlate', formatted)
    setPlateError(validateLicensePlate(formatted).error)
  }

  // Offline best-effort decode (see lib/vinDecode.ts) — cheap enough to
  // recompute on every render rather than needing an effect.
  const decoded = draft.vin.length === 17 ? decodeVin(draft.vin) : null
  const canApplyDecoded =
    !!decoded && ((!!decoded.manufacturer && !draft.make) || (!!decoded.modelYear && !draft.year))

  // Only ever fills a field that's currently blank — never overwrites what
  // the tech already typed or what an existing vehicle already had.
  const applyDecodedVin = () => {
    if (!decoded) return
    setDraft(d => ({
      ...d,
      make: decoded.manufacturer && !d.make ? decoded.manufacturer : d.make,
      year: decoded.modelYear && !d.year ? String(decoded.modelYear) : d.year,
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const validation = validateVehicleDraft(draft)
    // Schedule choice only matters when creating — an edit's onSave ignores
    // the second argument entirely (see Vehicles.tsx's handleSave), so this
    // dummy value here can't leak into it.
    const schedule = vehicle
      ? { mode: 'custom' as const, serviceIds: [] }
      : scheduleChoiceFromForm(scheduleMode, selectedServiceIds, oilIntervalKmOverride)
    if (!validation.ok || !schedule) {
      // Surface every field error at once; a blank make/model is already marked
      // required on the inputs themselves, so it needs no extra message.
      setVinError(validation.ok ? undefined : validation.vinError)
      setPlateError(validation.ok ? undefined : validation.plateError)
      setOilIntervalError(schedule ? undefined : t('vehicles.customerIntervalRequiredError'))
      return
    }
    onSave(
      vehicleDraftToData(draft, {
        isNew: !vehicle,
        ownerHasVehicles: ownerHasVehicle(vehicles, draft),
      }),
      schedule
    )
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
                  checked={draft.ownerType === 'customer'}
                  onChange={() => set('ownerType', 'customer')}
                  className="accent-accent"
                />
                {t('vehicles.individualCustomer')}
              </label>
              <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                <input
                  type="radio"
                  checked={draft.ownerType === 'company'}
                  onChange={() => set('ownerType', 'company')}
                  className="accent-accent"
                />
                {t('vehicles.companyFleet')}
              </label>
            </div>
            {draft.ownerType === 'customer' ? (
              <Select value={draft.customerId} onChange={(e) => set('customerId', e.target.value)}>
                <option value="">{t('vehicles.selectCustomerPlaceholder')}</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            ) : (
              <Select value={draft.companyId} onChange={(e) => set('companyId', e.target.value)}>
                <option value="">{t('vehicles.selectCompanyPlaceholder')}</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.companyName}</option>
                ))}
              </Select>
            )}
          </div>

          {!vehicle && (
            <NewVehicleScheduleFields
              mode={scheduleMode}
              onModeChange={setScheduleMode}
              candidates={candidates}
              selected={selectedServiceIds}
              onToggle={(serviceId) =>
                setSelectedServiceIds((s) => toggleScheduleSelection(candidates, s, serviceId))
              }
              oilIntervalKm={oilIntervalKmOverride}
              onOilIntervalKmChange={(value) => {
                setOilIntervalKmOverride(value)
                setOilIntervalError(undefined)
              }}
              oilIntervalError={oilIntervalError}
            />
          )}

          {/* Editing an existing vehicle manages its schedule right here —
           *  no separate "Manage Schedule" dialog anymore (see Vehicles.tsx).
           *  Same slot the create-only setup block above occupies, so the
           *  heading lands in the same place either way. */}
          {vehicle && <ScheduleRulesEditor vehicle={vehicle} />}

          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-3">{t('vehicles.basicInformationHeading')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <Input label={t('vehicles.makeLabel')} value={draft.make} onChange={(e) => set('make', e.target.value)} placeholder="Toyota" required />
              <Input label={t('vehicles.modelLabel')} value={draft.model} onChange={(e) => set('model', e.target.value)} placeholder="Camry" required />
              <Input label={t('vehicles.yearLabel')} type="number" mono value={draft.year} onChange={(e) => set('year', e.target.value)} placeholder="2020" />
              <Input label={t('vehicles.colorLabel')} value={draft.color} onChange={(e) => set('color', e.target.value)} placeholder="Silver" />
              <Input
                label={t('vehicles.licensePlateLabel')}
                mono
                value={draft.licensePlate}
                onChange={(e) => handlePlateChange(e.target.value)}
                placeholder="B 1234 XYZ"
                error={plateError}
              />
              <div>
                <Input
                  label={t('vehicles.vinFieldLabel')}
                  mono
                  value={draft.vin}
                  onChange={(e) => handleVinChange(e.target.value)}
                  placeholder="1HGBH41JXMN109186"
                  error={vinError}
                />
                {!vinError && draft.vin && draft.vin.length < 17 && (
                  <p className="text-xs text-text-secondary mt-1">{t('vehicles.vinCharCount', { count: draft.vin.length })}</p>
                )}
                {decoded && vinDecodeSummary(decoded) && (
                  <p className="mt-1 text-xs text-fg-3">
                    {vinDecodeSummary(decoded)}
                    {canApplyDecoded && (
                      <button type="button" onClick={applyDecodedVin} className="ml-2 text-accent hover:underline">
                        {t('vehicles.vinApplyDecoded')}
                      </button>
                    )}
                  </p>
                )}
              </div>
              <Input label={t('vehicles.currentMileageLabel')} type="number" mono value={draft.currentMileage} onChange={(e) => set('currentMileage', e.target.value)} placeholder="50000" />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-3">{t('vehicles.engineHeading')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <Select label={t('vehicles.engineTypeLabel')} value={draft.engineType} onChange={(e) => set('engineType', e.target.value)}>
                <option value="">{t('vehicles.selectPlaceholder')}</option>
                <option value="Gasoline">{t('vehicles.engineGasoline')}</option>
                <option value="Diesel">{t('vehicles.engineDiesel')}</option>
                <option value="Hybrid">{t('vehicles.engineHybrid')}</option>
                <option value="Electric">{t('vehicles.engineElectric')}</option>
              </Select>
              <Input label={t('vehicles.engineSizeLabel')} value={draft.engineSize} onChange={(e) => set('engineSize', e.target.value)} placeholder="2.5L, V6" />
              <Input label={t('vehicles.oilTypeRequiredLabel')} value={draft.oilTypeRequired} onChange={(e) => set('oilTypeRequired', e.target.value)} placeholder="5W-30, 0W-20" />
              <Input label={t('vehicles.oilCapacityLabel')} value={draft.oilCapacity} onChange={(e) => set('oilCapacity', e.target.value)} placeholder="4.5 L" />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-3">{t('vehicles.transmissionHeading')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <Select label={t('vehicles.transmissionTypeLabel')} value={draft.transmissionType} onChange={(e) => set('transmissionType', e.target.value)}>
                <option value="">{t('vehicles.selectPlaceholder')}</option>
                <option value="Automatic">{t('vehicles.transmissionAutomatic')}</option>
                <option value="Manual">{t('vehicles.transmissionManual')}</option>
                <option value="CVT">{t('vehicles.transmissionCVT')}</option>
                <option value="ATF">{t('vehicles.transmissionATF')}</option>
              </Select>
              <Input label={t('vehicles.transmissionFluidTypeLabel')} value={draft.transmissionFluidType} onChange={(e) => set('transmissionFluidType', e.target.value)} placeholder="ATF Type T-IV" />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-3">{t('vehicles.gardanHeading')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <Select label={t('vehicles.driveTypeLabel')} value={draft.driveType} onChange={(e) => set('driveType', e.target.value)}>
                <option value="">{t('vehicles.selectPlaceholder')}</option>
                <option value="FWD">{t('vehicles.driveFWD')}</option>
                <option value="RWD">{t('vehicles.driveRWD')}</option>
                <option value="AWD">{t('vehicles.driveAWD')}</option>
                <option value="4WD">{t('vehicles.drive4WD')}</option>
              </Select>
              <Input label={t('vehicles.differentialFluidTypeLabel')} value={draft.differentialFluidType} onChange={(e) => set('differentialFluidType', e.target.value)} placeholder="75W-90" />
            </div>
          </div>

          <Textarea label={t('vehicles.notesLabel')} value={draft.notes} onChange={(e) => set('notes', e.target.value)} rows={2} />

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
