// Used by the standalone printReceipt HTML builder so due lines are computed
// in one place instead of being re-derived inline.
import { useScheduleRuleStore } from '../store/scheduleRuleStore'
import { useServiceItemTypeStore } from '../store/serviceItemTypeStore'
import { groupDueLines, formatDueLine, dueLineTone, dueDateTone } from './scheduleEngine'
import { itemTypeNameLookup } from './entities'
import { translate } from './i18n'

/**
 * `currentOdometer` judges the km axis the same way vehicleDueSummary.ts's
 * badges do; `now` (defaulted, injectable for tests) judges the date axis. A
 * line already past either mark gets a translated "(Overdue)" suffix instead
 * of printing identically to one still ahead — a receipt used to hand a
 * customer a next-due mark that was already in the past with no indication
 * it was late.
 */
export function buildDueLinesText(vehicleId: string, currentOdometer: number, now: Date = new Date()): string[] {
  const rules = useScheduleRuleStore.getState().scheduleRules.filter((r) => r.vehicleId === vehicleId)
  const itemTypes = useServiceItemTypeStore.getState().serviceItemTypes
  const itemTypeName = itemTypeNameLookup(itemTypes)

  return groupDueLines(rules).map((line) => {
    const { when, what } = formatDueLine(line, itemTypeName)
    const overdue =
      (line.dueKm != null && dueLineTone(line.dueKm, currentOdometer) === 'overdue') ||
      (line.dueDate != null && dueDateTone(line.dueDate, now) === 'overdue')
    const text = `${when} — ${what}`
    return overdue ? `${text} ${translate('receipt.overdueSuffix')}` : text
  })
}
