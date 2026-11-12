import type { ScheduleRule } from '../../store/scheduleRuleStore'
import { scheduleRuleSummary } from '../../lib/schedule/scheduleRuleForm'
import { dueLineToneOf, formatDueLine, groupDueLines } from '../../lib/schedule/scheduleEngine'
import { dueToneLabel, dueToneBadgeTone } from '../../lib/vehicles/vehicleDueSummary'
import { useTranslation } from '../../lib/i18n'
import { Badge } from '../ui/Badge'
import { RowActions } from '../ui/RowActions'

/** One live rule: the item, where its interval puts the next service and
 *  whether that is already overdue, then the interval itself ("every 5,000 km
 *  from 10,000 / every 4 months from Aug 10 · Customer request") — plus
 *  edit/delete actions. */
export function ScheduleRuleRow({
  rule,
  itemTypeName,
  currentOdometer,
  now = new Date(),
  onEdit,
  onDelete,
}: {
  rule: ScheduleRule
  itemTypeName: (id: string) => string
  /** The vehicle's last known reading — 0 when none was ever recorded. */
  currentOdometer: number
  now?: Date
  onEdit: () => void
  onDelete: () => void
}) {
  const { t } = useTranslation()
  const summary = scheduleRuleSummary(rule)

  const parts: string[] = []
  if (summary.kmPart) {
    parts.push(t('vehicles.scheduleLineKm', { interval: summary.kmPart.interval, base: summary.kmPart.base }))
  }
  if (summary.monthsPart) {
    parts.push(t('vehicles.scheduleLineMonths', { months: summary.monthsPart.months, base: summary.monthsPart.base }))
  }
  const sourceLabel = summary.isCustomerRequest ? t('vehicles.sourceCustomerRequest') : t('vehicles.sourceWorkshopDefault')

  const dueLine = groupDueLines([rule])[0]
  const tone = dueLine ? dueLineToneOf(dueLine, currentOdometer, now) : 'on_track'
  const nextDue = dueLine ? formatDueLine(dueLine, itemTypeName).when : ''

  return (
    <div className="flex items-center justify-between gap-3 p-2 bg-surface-card border border-border-1 rounded-radius-sm text-sm">
      <div className="min-w-0 space-y-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-text-primary font-medium">{itemTypeName(rule.itemTypeId)}</span>
          {tone !== 'on_track' && <Badge tone={dueToneBadgeTone(tone)}>{dueToneLabel(tone)}</Badge>}
        </div>
        {nextDue && <p className="text-text-primary tabular-nums">{t('vehicles.scheduleNextDue', { when: nextDue })}</p>}
        <p className="text-xs text-text-secondary tabular-nums">{`${parts.join(' / ')} · ${sourceLabel}`}</p>
      </div>
      <RowActions onEdit={onEdit} onDelete={onDelete} />
    </div>
  )
}
