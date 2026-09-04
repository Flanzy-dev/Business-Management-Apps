import type { VehicleDueStatus } from '../../lib/vehicleDueSummary'
import { formatDueLine } from '../../lib/scheduleEngine'
import { useTranslation } from '../../lib/i18n'

/** The "what's due, and when" lines under a vehicle row's expanded due-status
 *  heading — a schedule-less vehicle gets one explanatory line instead. */
export function VehicleDueLines({ status, itemTypeName }: { status: VehicleDueStatus; itemTypeName: (id: string) => string }) {
  const { t } = useTranslation()

  if (status.kind === 'no_schedule') {
    return <p className="text-text-secondary text-sm mb-4">{t('vehicles.dueNoScheduleLong')}</p>
  }

  return (
    <div className="space-y-1 mb-4 text-sm">
      {status.lines.map((line) => {
        const { when, what } = formatDueLine(line, itemTypeName)
        return (
          <p key={`${line.dueKm}-${line.dueDate}`} className="text-text-secondary">
            <span className="text-text-primary tabular-nums font-mono">{when}</span>
            {' — '}
            {what}
          </p>
        )
      })}
    </div>
  )
}
