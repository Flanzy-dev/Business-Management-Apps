// The rule-list + add/edit form half of what used to be the standalone
// ManageScheduleDialog — extracted so it can be embedded directly inside
// VehicleModal's Edit view (no separate dialog/entry point anymore, see
// Vehicles.tsx). Every rule change here is immediate: clicking Save/Delete
// calls setScheduleRule/deleteScheduleRule directly, independent of whatever
// the surrounding form's own Save button does — that has to stay true now
// that there's no dedicated DialogFooter of its own to signal "committed".
import { useState } from 'react'
import { useScheduleRuleStore } from '../../store/scheduleRuleStore'
import { useServiceItemTypeStore } from '../../store/serviceItemTypeStore'
import { useServiceCatalogStore } from '../../store/serviceCatalogStore'
import { useSettingsStore, DEFAULT_SERVICE_INTERVAL_KM, DEFAULT_SERVICE_INTERVAL_MONTHS } from '../../store/settingsStore'
import { useConfirmStore } from '../../store/confirmStore'
import { Vehicle } from '../../store/vehicleStore'
import { setScheduleRule, deleteScheduleRule } from '../../lib/ops/scheduleOps'
import { resolveDefaultCatalogMatch } from '../../lib/serviceCatalog'
import { activeRulesForVehicle } from '../../lib/scheduleEngine'
import {
  ScheduleRuleDraft,
  SchedulePrefill,
  emptyScheduleDraft,
  scheduleDraftFor,
  validateScheduleDraft,
  scheduleDraftToRuleData,
} from '../../lib/scheduleRuleForm'
import { itemTypeNameLookup } from '../../lib/entities'
import { useTranslation } from '../../lib/i18n'
import { ScheduleRuleRow } from './ScheduleRuleRow'
import { ScheduleRuleForm } from './ScheduleRuleForm'

const today = () => new Date().toISOString().slice(0, 10)

export function ScheduleRulesEditor({ vehicle }: { vehicle: Vehicle }) {
  const { t } = useTranslation()
  const scheduleRules = useScheduleRuleStore((s) => s.scheduleRules)
  const serviceItemTypes = useServiceItemTypeStore((s) => s.serviceItemTypes)
  const services = useServiceCatalogStore((s) => s.services)
  const settings = useSettingsStore((s) => s.settings)
  const requestConfirm = useConfirmStore((s) => s.request)
  const liveRules = activeRulesForVehicle(scheduleRules, vehicle.id)

  const [selectedItemTypeId, setSelectedItemTypeId] = useState('')
  const [draft, setDraft] = useState<ScheduleRuleDraft>(emptyScheduleDraft)
  const [prefilledFrom, setPrefilledFrom] = useState<SchedulePrefill | null>(null)

  const set = <K extends keyof ScheduleRuleDraft>(key: K, value: ScheduleRuleDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }))

  const itemTypeName = itemTypeNameLookup(serviceItemTypes)

  // Selecting an item type with an existing rule loads it for editing;
  // selecting one without a rule starts a blank entry — either way, saving
  // goes through the same supersede-and-replace op. The three-branch prefill
  // itself (existing rule / catalog match / shop default) lives in
  // scheduleRuleForm.ts's scheduleDraftFor, same reasoning vehicleForm.ts
  // documents for VehicleModal.tsx.
  const selectItemType = (id: string) => {
    setSelectedItemTypeId(id)
    const existing = liveRules.find((r) => r.itemTypeId === id)
    // Auto-fill from the catalog's default interval for this schedule tag —
    // only when there's exactly one candidate, or the shop has explicitly
    // marked one as the default among several (see ServiceCatalogTable).
    // Ambiguous (several candidates, none marked default) still falls through
    // to the shop-wide default rather than guessing between them.
    const catalogMatch = existing ? null : resolveDefaultCatalogMatch(services, id)
    const { draft: nextDraft, prefilledFrom: nextPrefill } = scheduleDraftFor(
      existing,
      catalogMatch,
      {
        km: settings.defaultServiceIntervalKm ?? DEFAULT_SERVICE_INTERVAL_KM,
        months: settings.defaultServiceIntervalMonths ?? DEFAULT_SERVICE_INTERVAL_MONTHS,
      },
      vehicle.currentMileage,
      today()
    )
    setDraft(nextDraft)
    setPrefilledFrom(nextPrefill)
  }

  const resetForm = () => {
    setSelectedItemTypeId('')
    setDraft(emptyScheduleDraft())
    setPrefilledFrom(null)
  }

  const scheduleValid = validateScheduleDraft(draft).ok

  const handleSave = () => {
    if (!selectedItemTypeId) return
    if (!scheduleValid) return
    setScheduleRule(vehicle.id, selectedItemTypeId, scheduleDraftToRuleData(draft))
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

  return (
    <div className="bg-surface-sunken p-4 rounded-radius-sm">
      <h3 className="text-sm font-semibold text-text-primary mb-3">{t('vehicles.scheduleSetupLabel')}</h3>
      <div className="space-y-4">
        {liveRules.length > 0 && (
          <div className="space-y-1">
            {liveRules.map((r) => (
              <ScheduleRuleRow
                key={r.id}
                rule={r}
                itemTypeName={itemTypeName}
                onEdit={() => selectItemType(r.itemTypeId)}
                onDelete={() => handleDelete(r.id, r.itemTypeId)}
              />
            ))}
          </div>
        )}

        <ScheduleRuleForm
          serviceItemTypes={serviceItemTypes}
          liveRules={liveRules}
          selectedItemTypeId={selectedItemTypeId}
          onSelectItemType={selectItemType}
          draft={draft}
          set={set}
          prefilledFrom={prefilledFrom}
          currentMileage={vehicle.currentMileage}
          saveDisabled={!selectedItemTypeId || !scheduleValid}
          onSave={handleSave}
          bordered={liveRules.length > 0}
        />
      </div>
    </div>
  )
}
