import type { ScheduleAxis, ScheduleDraftField, ScheduleRuleDraft, SchedulePrefill } from '../../lib/schedule/scheduleRuleForm'
import { formatDistance } from '../../lib/format/numbers'
import { useTranslation } from '../../lib/i18n'
import { Input } from '../ui/Input'
import { RadioGroup } from '../ui/Checkbox'

const SCHEDULE_AXIS_I18N_KEYS: Record<ScheduleAxis, string> = {
  km: 'common.intervalAxisKm',
  months: 'common.intervalAxisMonths',
  both: 'common.intervalAxisBoth',
}

/** Track-by radios plus whichever of the km/months interval+base fields the
 *  chosen axis needs — a field switched away from keeps its typed value
 *  (see scheduleDraftToRuleData), so this only ever hides fields, never
 *  clears them. */
export function ScheduleAxisFields({
  draft,
  set,
  errors,
  prefilledFrom,
  currentMileage,
}: {
  draft: ScheduleRuleDraft
  set: <K extends keyof ScheduleRuleDraft>(key: K, value: ScheduleRuleDraft[K]) => void
  /** Field -> i18n key, for a value that is typed but not usable. */
  errors: Partial<Record<ScheduleDraftField, string>>
  prefilledFrom: SchedulePrefill | null
  currentMileage: number | null
}) {
  const { t } = useTranslation()
  const err = (field: ScheduleDraftField) => (errors[field] ? t(errors[field]!) : undefined)
  const usesKm = draft.axis === 'km' || draft.axis === 'both'
  const usesMonths = draft.axis === 'months' || draft.axis === 'both'

  return (
    <>
      <RadioGroup
        className="mb-3"
        legend={t('vehicles.scheduleAxisLabel')}
        value={draft.axis}
        onChange={(a) => set('axis', a)}
        options={(['km', 'months', 'both'] as const).map((a) => ({ value: a, label: t(SCHEDULE_AXIS_I18N_KEYS[a]) }))}
      />
      <div className="grid grid-cols-2 gap-4">
        {usesKm && (
          <Input
            label={t('vehicles.intervalLabel')}
            type="number"
            mono
            value={draft.intervalKm}
            onChange={(e) => set('intervalKm', e.target.value)}
            error={err('intervalKm')}
            min={1}
            inputMode="numeric"
            placeholder="5000"
          />
        )}
        {usesMonths && (
          <Input
            label={t('vehicles.intervalMonthsLabel')}
            type="number"
            mono
            value={draft.intervalMonths}
            onChange={(e) => set('intervalMonths', e.target.value)}
            error={err('intervalMonths')}
            min={1}
            inputMode="numeric"
            placeholder="4"
          />
        )}
        {prefilledFrom && (
          <p className="col-span-2 -mt-2 text-xs text-fg-3">
            {prefilledFrom.kind === 'service'
              ? t('vehicles.scheduleDefaultPrefillHint', { service: prefilledFrom.name })
              : t('vehicles.scheduleDefaultPrefillShopHint')}
          </p>
        )}
        {usesKm && (
          <div>
            <Input
              label={t('vehicles.baseOdometerLabel')}
              type="number"
              mono
              value={draft.baseOdometer}
              onChange={(e) => set('baseOdometer', e.target.value)}
              error={err('baseOdometer')}
              min={0}
              inputMode="numeric"
              placeholder="209147"
            />
            {currentMileage != null && (
              <p className="mt-1 text-xs text-fg-3">{t('vehicles.currentOdometerHint', { km: formatDistance(currentMileage) })}</p>
            )}
          </div>
        )}
        {usesMonths && (
          <Input
            label={t('vehicles.baseDateLabel')}
            type="date"
            mono
            value={draft.baseDate}
            onChange={(e) => set('baseDate', e.target.value)}
            error={err('baseDate')}
          />
        )}
      </div>
    </>
  )
}
