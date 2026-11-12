// The receipt's "next service" rows, computed in one place. Pure row-building
// (describeDueLines) is separate from the store reads (buildReceiptDueLines),
// so the ordering and the overdue rule are testable without booting stores.
import { useScheduleRuleStore } from '../../store/scheduleRuleStore'
import { useServiceItemTypeStore } from '../../store/serviceItemTypeStore'
import { groupDueLines, dueLineTone, dueDateTone, type DueLine } from '../schedule/scheduleEngine'
import { itemTypeNameLookup } from '../format/entities'

/** One printed row: what is due, and by which mark (km and/or date). */
export interface ReceiptDueLine {
  /** One item type's name — "Oli Mesin". */
  what: string
  dueKm: number | null
  /** 'YYYY-MM-DD' (or an ISO instant), as the schedule rule stores it. */
  dueDate: string | null
  /** Already past either mark — printed bold with a leading "!". */
  overdue: boolean
}

/** Overdue rows first, then the nearest mark: earliest date, then lowest km;
 *  a row with no date (or no km) sorts after one that has it. */
function compareRows(a: ReceiptDueLine, b: ReceiptDueLine): number {
  if (a.overdue !== b.overdue) return a.overdue ? -1 : 1
  if (a.dueDate !== b.dueDate) {
    if (a.dueDate === null) return 1
    if (b.dueDate === null) return -1
    return a.dueDate.localeCompare(b.dueDate)
  }
  if (a.dueKm !== b.dueKm) {
    if (a.dueKm === null) return 1
    if (b.dueKm === null) return -1
    return a.dueKm - b.dueKm
  }
  return 0
}

/**
 * `currentOdometer` judges the km axis the same way vehicleDueSummary.ts's
 * badges do; `now` (injectable for tests) judges the date axis. A row already
 * past either mark is `overdue`, so a receipt never hands a customer a mark
 * that is already behind them without saying so.
 */
export function describeDueLines(
  lines: DueLine[],
  currentOdometer: number,
  now: Date,
  itemTypeName: (id: string) => string
): ReceiptDueLine[] {
  // One row per item type, even when two share a mark (engine oil and its
  // filter usually do): the marks repeat, but every row reads on one line
  // instead of a joined name that wraps and pushes the numbers off it.
  return lines
    .flatMap((line) => {
      const overdue =
        (line.dueKm != null && dueLineTone(line.dueKm, currentOdometer) === 'overdue') ||
        (line.dueDate != null && dueDateTone(line.dueDate, now) === 'overdue')
      return line.itemTypeIds.map((id) => ({ what: itemTypeName(id), dueKm: line.dueKm, dueDate: line.dueDate, overdue }))
    })
    .sort(compareRows)
}

export function buildReceiptDueLines(vehicleId: string, currentOdometer: number, now: Date = new Date()): ReceiptDueLine[] {
  const rules = useScheduleRuleStore.getState().scheduleRules.filter((r) => r.vehicleId === vehicleId)
  const itemTypeName = itemTypeNameLookup(useServiceItemTypeStore.getState().serviceItemTypes)
  return describeDueLines(groupDueLines(rules), currentOdometer, now, itemTypeName)
}
