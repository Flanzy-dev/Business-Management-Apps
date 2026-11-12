import { useId } from 'react'
import { serviceItemTypeLabel, serviceIntervalLabel, serviceCatalogLabel } from '../../lib/format/entities'
import type { ScheduleMode, ScheduleSetupCandidate } from '../../lib/vehicles/vehicleForm'
import { useTranslation } from '../../lib/i18n'
import { Input } from '../ui/Input'
import { Checkbox, Radio } from '../ui/Checkbox'

/**
 * The create-only "what should this vehicle's service schedule start as"
 * picker — three radios:
 * - Workshop Default: a checklist, one row per catalog service with an
 *   interval, grouped under its schedule tag; a tag with several candidate
 *   services (e.g. manual vs matic transmission oil) lists all of them so the
 *   shop can pick the right one per vehicle instead of the tag being skipped.
 * - Customer Interval: seeds every unambiguously resolvable item type, then
 *   overrides engine oil with a km interval typed in here.
 * - Custom: seeds nothing — the shop sets it up later from the vehicle's own
 *   Edit view (ScheduleRulesEditor).
 */
export function NewVehicleScheduleFields({
  mode,
  onModeChange,
  candidates,
  selected,
  onToggle,
  oilIntervalKm,
  onOilIntervalKmChange,
  oilIntervalError,
}: {
  mode: ScheduleMode
  onModeChange: (mode: ScheduleMode) => void
  candidates: ScheduleSetupCandidate[]
  selected: Record<string, boolean>
  onToggle: (serviceId: string) => void
  oilIntervalKm: string
  onOilIntervalKmChange: (value: string) => void
  oilIntervalError: string | undefined
}) {
  const { t } = useTranslation()
  // The three choices have details between them, so they can't be one
  // RadioGroup; a shared name still makes them one group for the arrow keys.
  const radioName = useId()

  // scheduleSetupCandidates already emits services in item-type order, so an
  // adjacent-run grouping is enough to cluster each tag's candidates together.
  const groups: { itemTypeId: string; itemTypeName: string; services: ScheduleSetupCandidate[] }[] = []
  for (const candidate of candidates) {
    const lastGroup = groups[groups.length - 1]
    if (lastGroup && lastGroup.itemTypeId === candidate.itemTypeId) {
      lastGroup.services.push(candidate)
    } else {
      groups.push({ itemTypeId: candidate.itemTypeId, itemTypeName: candidate.itemTypeName, services: [candidate] })
    }
  }

  return (
    <fieldset className="bg-surface-sunken p-4 rounded-radius-sm">
      <legend className="float-left w-full block text-2xs uppercase font-semibold tracking-wide text-fg-3 mb-2">{t('vehicles.scheduleSetupLabel')}</legend>
      <div className="clear-left space-y-3">
        <div>
          <Radio name={radioName} checked={mode === 'workshop_default'} onChange={() => onModeChange('workshop_default')}>
            {t('vehicles.scheduleModeWorkshopDefault')}
          </Radio>
          {mode === 'workshop_default' && (
            <div className="mt-2 ml-6 space-y-3">
              {groups.length === 0 ? (
                <p className="text-xs text-fg-3">{t('vehicles.scheduleChecklistEmptyHint')}</p>
              ) : (
                groups.map((group) => (
                  <div key={group.itemTypeId}>
                    <p className="text-2xs uppercase tracking-wide text-fg-3 mb-1">{serviceItemTypeLabel(group.itemTypeName)}</p>
                    <div className="space-y-1">
                      {group.services.map((candidate) => (
                        <Checkbox key={candidate.serviceId} checked={!!selected[candidate.serviceId]} onChange={() => onToggle(candidate.serviceId)}>
                          <span className="text-text-primary">{serviceCatalogLabel(candidate.serviceName)}</span>
                          <span className="ml-2 text-2xs text-fg-3">
                            {serviceIntervalLabel(candidate.intervalKm, candidate.intervalMonths)}
                          </span>
                        </Checkbox>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div>
          <Radio name={radioName} checked={mode === 'customer_interval'} onChange={() => onModeChange('customer_interval')}>
            {t('vehicles.scheduleModeCustomerInterval')}
          </Radio>
          {mode === 'customer_interval' && (
            <div className="mt-2 ml-6 max-w-[220px]">
              <Input
                label={t('vehicles.customerOilIntervalLabel')}
                type="number"
                mono
                value={oilIntervalKm}
                onChange={(e) => onOilIntervalKmChange(e.target.value)}
                placeholder="5000"
                error={oilIntervalError}
              />
            </div>
          )}
        </div>

        <Radio name={radioName} checked={mode === 'custom'} onChange={() => onModeChange('custom')}>
            {t('vehicles.scheduleModeCustom')}
          </Radio>
      </div>
    </fieldset>
  )
}
