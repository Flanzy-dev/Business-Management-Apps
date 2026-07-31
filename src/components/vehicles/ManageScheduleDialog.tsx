import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { useScheduleRuleStore } from '../../store/scheduleRuleStore'
import { useServiceItemTypeStore } from '../../store/serviceItemTypeStore'
import { useServiceCatalogStore } from '../../store/serviceCatalogStore'
import { useConfirmStore } from '../../store/confirmStore'
import { Vehicle } from '../../store/vehicleStore'
import { setScheduleRule, deleteScheduleRule } from '../../lib/ops/scheduleOps'
import { resolveDefaultCatalogMatch } from '../../lib/serviceCatalog'
import { formatDistance } from '../../lib/units'
import { formatDate } from '../../lib/dates'
import { vehicleLabel, serviceItemTypeLabel } from '../../lib/entities'
import { useTranslation } from '../../lib/i18n'
import { Dialog, DialogFooter } from '../ui/Dialog'
import { Input, Select } from '../ui/Input'
import { Button } from '../ui/Button'
import { DropdownMenu } from '../ui/DropdownMenu'

const today = () => new Date().toISOString().slice(0, 10)

export function ManageScheduleDialog({ vehicle, onClose }: { vehicle: Vehicle; onClose: () => void }) {
  const { t } = useTranslation()
  const scheduleRules = useScheduleRuleStore((s) => s.scheduleRules)
  const serviceItemTypes = useServiceItemTypeStore((s) => s.serviceItemTypes)
  const services = useServiceCatalogStore((s) => s.services)
  const requestConfirm = useConfirmStore((s) => s.request)
  const liveRules = scheduleRules.filter((r) => r.vehicleId === vehicle.id && r.supersededAt === null)

  const [selectedItemTypeId, setSelectedItemTypeId] = useState('')
  const [intervalKm, setIntervalKm] = useState('')
  const [baseOdometer, setBaseOdometer] = useState('')
  const [intervalMonths, setIntervalMonths] = useState('')
  const [baseDate, setBaseDate] = useState('')
  const [source, setSource] = useState<'workshop_default' | 'customer_request'>('workshop_default')
  const [prefilledFrom, setPrefilledFrom] = useState<string | null>(null)

  const itemTypeName = (id: string) => {
    const found = serviceItemTypes.find((it) => it.id === id)
    return found ? serviceItemTypeLabel(found.name) : t('common.unknown')
  }

  // Selecting an item type with an existing rule loads it for editing;
  // selecting one without a rule starts a blank entry — either way, saving
  // goes through the same supersede-and-replace op.
  const selectItemType = (id: string) => {
    setSelectedItemTypeId(id)
    const existing = liveRules.find((r) => r.itemTypeId === id)
    if (existing) {
      setIntervalKm(existing.intervalKm != null ? String(existing.intervalKm) : '')
      setBaseOdometer(existing.baseOdometer != null ? String(existing.baseOdometer) : '')
      setIntervalMonths(existing.intervalMonths ? String(existing.intervalMonths) : '')
      setBaseDate(existing.baseDate ?? '')
      setSource(existing.source)
      setPrefilledFrom(null)
      return
    }
    setIntervalKm('')
    setIntervalMonths('')
    // Prefill with the vehicle's current reading / today — the common case is
    // setting up the schedule while servicing the car now. Still fully
    // editable for a backdated entry.
    setBaseOdometer(vehicle.currentMileage != null ? String(vehicle.currentMileage) : '')
    setBaseDate(today())
    setSource('workshop_default')

    // Auto-fill from the catalog's default interval for this schedule tag —
    // only when there's exactly one candidate, or the shop has explicitly
    // marked one as the default among several (see ServiceCatalogTable).
    // Otherwise (ambiguous, no default set) this stays blank rather than
    // guessing which one applies.
    const match = resolveDefaultCatalogMatch(services, id)
    if (match) {
      if (match.intervalKm) setIntervalKm(String(match.intervalKm))
      if (match.intervalMonths) setIntervalMonths(String(match.intervalMonths))
      setPrefilledFrom(match.name)
    } else {
      setPrefilledFrom(null)
    }
  }

  const resetForm = () => {
    setSelectedItemTypeId('')
    setIntervalKm('')
    setBaseOdometer('')
    setIntervalMonths('')
    setBaseDate('')
    setSource('workshop_default')
    setPrefilledFrom(null)
  }

  const handleSave = () => {
    if (!selectedItemTypeId) return
    if (!intervalKm && !intervalMonths) return
    if (!!intervalKm !== !!baseOdometer) return
    if (!!intervalMonths !== !!baseDate) return
    setScheduleRule(vehicle.id, selectedItemTypeId, {
      intervalKm: intervalKm ? parseInt(intervalKm) : null,
      baseOdometer: baseOdometer ? parseInt(baseOdometer) : null,
      intervalMonths: intervalMonths ? parseInt(intervalMonths) : null,
      baseDate: baseDate || null,
      source,
    })
    resetForm()
  }

  const handleDelete = (ruleId: string, itemTypeId: string) => {
    requestConfirm(
      {
        title: t('vehicles.deleteScheduleRuleTitle'),
        message: t('vehicles.deleteScheduleRuleMessage', { item: itemTypeName(itemTypeId) }),
        tone: 'danger',
      },
      () => {
        deleteScheduleRule(ruleId)
        if (selectedItemTypeId === itemTypeId) resetForm()
      }
    )
  }

  const saveDisabled =
    !selectedItemTypeId ||
    (!intervalKm && !intervalMonths) ||
    !!intervalKm !== !!baseOdometer ||
    !!intervalMonths !== !!baseDate

  return (
    <Dialog open onClose={onClose} title={t('vehicles.manageScheduleTitle', { vehicle: vehicleLabel(vehicle) })} size="xl">
      <div className="space-y-4">
        {liveRules.length > 0 && (
          <div className="space-y-1">
            {liveRules.map((r) => {
              const parts: string[] = []
              if (r.intervalKm != null && r.baseOdometer != null) {
                parts.push(t('vehicles.scheduleLineKm', { interval: r.intervalKm.toLocaleString(), base: r.baseOdometer.toLocaleString() }))
              }
              if (r.intervalMonths != null && r.baseDate) {
                parts.push(t('vehicles.scheduleLineMonths', { months: r.intervalMonths, base: formatDate(r.baseDate) }))
              }
              const sourceLabel = r.source === 'customer_request' ? t('vehicles.sourceCustomerRequest') : t('vehicles.sourceWorkshopDefault')
              return (
                <div key={r.id} className="flex items-center justify-between gap-2 p-2 bg-surface-sunken rounded-radius-sm text-sm">
                  <span className="text-text-primary">{itemTypeName(r.itemTypeId)}</span>
                  <span className="text-text-secondary tabular-nums text-right">
                    {`${parts.join(' / ')} · ${sourceLabel}`}
                  </span>
                  <DropdownMenu
                    items={[
                      { label: t('common.edit'), icon: Pencil, onClick: () => selectItemType(r.itemTypeId) },
                      { label: t('common.delete'), icon: Trash2, variant: 'danger', onClick: () => handleDelete(r.id, r.itemTypeId) },
                    ]}
                  />
                </div>
              )
            })}
          </div>
        )}

        <div className={liveRules.length > 0 ? 'border-t border-border-subtle pt-4' : ''}>
          <Select
            label={t('vehicles.itemTypeLabel')}
            value={selectedItemTypeId}
            onChange={(e) => selectItemType(e.target.value)}
          >
            <option value="">{t('vehicles.selectItemType')}</option>
            {serviceItemTypes.map((itemType) => (
              <option key={itemType.id} value={itemType.id}>
                {serviceItemTypeLabel(itemType.name)}{liveRules.some((r) => r.itemTypeId === itemType.id) ? t('vehicles.editExistingSuffix') : ''}
              </option>
            ))}
          </Select>

          {selectedItemTypeId && (
            <div className="grid grid-cols-2 gap-4 mt-3">
              <Input
                label={t('vehicles.intervalLabel')}
                type="number"
                mono
                value={intervalKm}
                onChange={(e) => setIntervalKm(e.target.value)}
                placeholder="5000"
              />
              <Input
                label={t('vehicles.intervalMonthsLabel')}
                type="number"
                mono
                value={intervalMonths}
                onChange={(e) => setIntervalMonths(e.target.value)}
                placeholder="4"
              />
              {prefilledFrom && (
                <p className="col-span-2 -mt-2 text-xs text-fg-3">
                  {t('vehicles.scheduleDefaultPrefillHint', { service: prefilledFrom })}
                </p>
              )}
              <div>
                <Input
                  label={t('vehicles.baseOdometerLabel')}
                  type="number"
                  mono
                  value={baseOdometer}
                  onChange={(e) => setBaseOdometer(e.target.value)}
                  placeholder="209147"
                />
                {vehicle.currentMileage != null && (
                  <p className="mt-1 text-xs text-fg-3">
                    {t('vehicles.currentOdometerHint', { km: formatDistance(vehicle.currentMileage) })}
                  </p>
                )}
              </div>
              <Input
                label={t('vehicles.baseDateLabel')}
                type="date"
                mono
                value={baseDate}
                onChange={(e) => setBaseDate(e.target.value)}
              />
              <div className="col-span-2">
                <label className="block text-2xs uppercase font-semibold tracking-wide text-fg-3 mb-1.5">{t('vehicles.sourceLabel')}</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                    <input
                      type="radio"
                      checked={source === 'workshop_default'}
                      onChange={() => setSource('workshop_default')}
                      className="accent-accent"
                    />
                    {t('vehicles.sourceWorkshopDefault')}
                  </label>
                  <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                    <input
                      type="radio"
                      checked={source === 'customer_request'}
                      onChange={() => setSource('customer_request')}
                      className="accent-accent"
                    />
                    {t('vehicles.sourceCustomerRequest')}
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <DialogFooter>
        <Button variant="ghost" type="button" onClick={onClose}>
          {t('common.close')}
        </Button>
        <Button variant="primary" onClick={handleSave} disabled={saveDisabled}>
          {t('common.save')}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
