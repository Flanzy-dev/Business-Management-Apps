import type { ServiceItemType } from '../../store/serviceItemTypeStore'
import type { ScheduleRule } from '../../store/scheduleRuleStore'
import type { ScheduleRuleDraft, SchedulePrefill } from '../../lib/scheduleRuleForm'
import { serviceItemTypeLabel } from '../../lib/entities'
import { useTranslation } from '../../lib/i18n'
import { Select } from '../ui/Input'
import { Button } from '../ui/Button'
import { ScheduleAxisFields } from './ScheduleAxisFields'
import { ScheduleSourceRadios } from './ScheduleSourceRadios'

/** The item-type picker plus, once one's selected, its axis/interval/source
 *  fields — the add/edit half of the schedule editor. Selecting an item type
 *  with an existing rule loads it for editing; the prefill decision itself
 *  lives in scheduleRuleForm.ts's scheduleDraftFor (see ScheduleRulesEditor). */
export function ScheduleRuleForm({
  serviceItemTypes,
  liveRules,
  selectedItemTypeId,
  onSelectItemType,
  draft,
  set,
  prefilledFrom,
  currentMileage,
  saveDisabled,
  onSave,
  bordered,
}: {
  serviceItemTypes: ServiceItemType[]
  liveRules: ScheduleRule[]
  selectedItemTypeId: string
  onSelectItemType: (id: string) => void
  draft: ScheduleRuleDraft
  set: <K extends keyof ScheduleRuleDraft>(key: K, value: ScheduleRuleDraft[K]) => void
  prefilledFrom: SchedulePrefill | null
  currentMileage: number | null
  saveDisabled: boolean
  onSave: () => void
  bordered: boolean
}) {
  const { t } = useTranslation()

  return (
    <div className={bordered ? 'border-t border-border-subtle pt-4' : ''}>
      <Select label={t('vehicles.itemTypeLabel')} value={selectedItemTypeId} onChange={(e) => onSelectItemType(e.target.value)}>
        <option value="">{t('vehicles.selectItemType')}</option>
        {serviceItemTypes.map((itemType) => (
          <option key={itemType.id} value={itemType.id}>
            {serviceItemTypeLabel(itemType.name)}
            {liveRules.some((r) => r.itemTypeId === itemType.id) ? t('vehicles.editExistingSuffix') : ''}
          </option>
        ))}
      </Select>

      {selectedItemTypeId && (
        <div className="mt-3">
          <ScheduleAxisFields draft={draft} set={set} prefilledFrom={prefilledFrom} currentMileage={currentMileage} />
          <div className="mt-4">
            <ScheduleSourceRadios source={draft.source} onChange={(source) => set('source', source)} />
          </div>
          <div className="mt-4 flex justify-end">
            {/* Saves immediately, independent of the vehicle form's own
             *  Save/Cancel — same behavior the standalone dialog had. */}
            <Button variant="secondary" type="button" onClick={onSave} disabled={saveDisabled}>
              {t('common.save')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
