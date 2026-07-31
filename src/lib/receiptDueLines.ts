// Shared by the Receipt React component and the standalone printReceipt HTML
// builder so the two implementations can't drift on how due lines are
// computed — both call this instead of re-deriving the loop separately.
import { useScheduleRuleStore } from '../store/scheduleRuleStore'
import { useServiceItemTypeStore } from '../store/serviceItemTypeStore'
import { groupDueLines } from './scheduleEngine'
import { translate } from './i18n'
import { serviceItemTypeLabel } from './entities'
import { formatDate } from './dates'

export function buildDueLinesText(vehicleId: string): string[] {
  const rules = useScheduleRuleStore.getState().scheduleRules.filter((r) => r.vehicleId === vehicleId)
  const itemTypes = useServiceItemTypeStore.getState().serviceItemTypes
  const itemTypeName = (id: string) => {
    const found = itemTypes.find((it) => it.id === id)
    return found ? serviceItemTypeLabel(found.name) : translate('common.unknown')
  }

  return groupDueLines(rules).map((line) => {
    const when = [
      line.dueKm != null ? `${line.dueKm.toLocaleString()} km` : null,
      line.dueDate != null ? formatDate(line.dueDate) : null,
    ].filter(Boolean).join(' / ')
    return `${when} — ${line.itemTypeIds.map(itemTypeName).join(', ')}`
  })
}
