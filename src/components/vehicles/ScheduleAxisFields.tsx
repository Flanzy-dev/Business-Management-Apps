import type { ScheduleAxis, ScheduleRuleDraft, SchedulePrefill } from '../../lib/scheduleRuleForm'
import { formatDistance } from '../../lib/units'
import { useTranslation } from '../../lib/i18n'
import { Input } from '../ui/Input'

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
  prefilledFrom,
  currentMileage,
}: {
  draft: ScheduleRuleDraft
  set: <K extends keyof ScheduleRuleDraft>(key: K, value: ScheduleRuleDraft[K]) => void
  prefilledFrom: SchedulePrefill | null
  currentMileage: number | null
}) {
  const { t } = useTranslation()
  const usesKm = draft.axis === 'km' || draft.axis === 'both'
  const usesMonths = draft.axis === 'months' || draft.axis === 'both'

  return (
    <>
      <label className="block text-2xs uppercase font-semibold tracking-wide text-fg-3 mb-1.5">
        {t('vehicles.scheduleAxisLabel')}
      </label>
      <div className="flex flex-wrap gap-4 mb-3">
        {(['km', 'months', 'both'] as const).map((a) => (
          <label key={a} className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
            <input type="radio" checked={draft.axis === a} onChange={() => set('axis', a)} className="accent-accent" />
            {t(SCHEDULE_AXIS_I18N_KEYS[a])}
          </label>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        {usesKm && (
          <Input
            label={t('vehicles.intervalLabel')}
            type="number"
            mono
            value={draft.intervalKm}
            onChange={(e) => set('intervalKm', e.target.value)}
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
          />
        )}
      </div>
    </>
  )
}
