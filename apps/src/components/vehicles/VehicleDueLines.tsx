import type { VehicleDueStatus } from '../../lib/vehicles/vehicleDueSummary'
import { dueToneLabel, dueToneBadgeTone } from '../../lib/vehicles/vehicleDueSummary'
import { dueLineToneOf, formatDueLine } from '../../lib/schedule/scheduleEngine'
import { useTranslation } from '../../lib/i18n'
import { Badge } from '../ui/Badge'

/** The "what's due, and when" lines under a vehicle row's expanded due-status
 *  heading — each marked overdue / due soon where it is, so the one line that
 *  made the vehicle's badge red is the one that stands out. A schedule-less
 *  vehicle gets one explanatory line instead. */
export function VehicleDueLines({
  status,
  itemTypeName,
  currentOdometer,
  now = new Date(),
}: {
  status: VehicleDueStatus
  itemTypeName: (id: string) => string
  /** The vehicle's last known reading — 0 when none was ever recorded. */
  currentOdometer: number
  now?: Date
}) {
  const { t } = useTranslation()

  if (status.kind === 'no_schedule') {
    return <p className="text-text-secondary text-sm mb-4">{t('vehicles.dueNoScheduleLong')}</p>
  }

  return (
    <ul className="space-y-1.5 mb-4 text-sm">
      {status.lines.map((line) => {
        const { when, what } = formatDueLine(line, itemTypeName)
        const tone = dueLineToneOf(line, currentOdometer, now)
        return (
          <li key={`${line.dueKm}-${line.dueDate}`} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-text-secondary">
            <span className={`tabular-nums font-mono text-text-primary ${tone === 'on_track' ? '' : 'font-semibold'}`}>{when}</span>
            <span aria-hidden="true">—</span>
            <span>{what}</span>
            {tone !== 'on_track' && <Badge tone={dueToneBadgeTone(tone)}>{dueToneLabel(tone)}</Badge>}
          </li>
        )
      })}
    </ul>
  )
}
