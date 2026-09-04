import type { ScheduleRule } from '../../store/scheduleRuleStore'
import { scheduleRuleSummary } from '../../lib/scheduleRuleForm'
import { useTranslation } from '../../lib/i18n'
import { RowActions } from '../ui/RowActions'

/** One live rule's summary line — "5,000 km from 10,000 / every 4 months
 *  from Aug 10 · Customer request" — plus its edit/delete actions. */
export function ScheduleRuleRow({
  rule,
  itemTypeName,
  onEdit,
  onDelete,
}: {
  rule: ScheduleRule
  itemTypeName: (id: string) => string
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

  return (
    <div className="flex items-center justify-between gap-2 p-2 bg-surface-card rounded-radius-sm text-sm">
      <span className="text-text-primary">{itemTypeName(rule.itemTypeId)}</span>
      <span className="text-text-secondary tabular-nums text-right">{`${parts.join(' / ')} · ${sourceLabel}`}</span>
      <RowActions onEdit={onEdit} onDelete={onDelete} />
    </div>
  )
}
